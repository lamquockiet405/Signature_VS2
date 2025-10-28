import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {
  FixSignatureDto,
  FixSignatureResponseDto,
} from '../dtos/fix-signature.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge = require('node-forge');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const signer = require('node-signpdf');

interface CertificateInfo {
  privateKey: any;
  certificate: any;
  certificateChain: any[];
  subjectCN: string;
}

@Injectable()
export class PdfSignService {
  /**
   * Sign PDF with P12 certificate
   */
  async signPDF(dto: FixSignatureDto): Promise<FixSignatureResponseDto> {
    try {
      console.log('🔧 === START PDF SIGNING ===');
      console.log('PDF:', dto.pdfPath);
      console.log('Certificate:', dto.certificatePath);

      // 1. Validate files
      this.validateInputFiles(dto);

      // 2. Load P12 certificate
      console.log('📜 Loading P12 certificate...');
      const certInfo = this.loadP12Certificate(
        dto.certificatePath!,
        dto.password!,
      );
      console.log(`✅ Certificate loaded: ${certInfo.subjectCN}`);
      console.log(`   Chain length: ${certInfo.certificateChain.length + 1}`);

      // 3. Read PDF
      const pdfBuffer = await fs.readFile(dto.pdfPath);

      // 4. Ensure PDF has signature field
      let pdfToSign = pdfBuffer;
      if (!this.hasSignatureField(pdfBuffer)) {
        console.log('📋 Adding signature field...');
        pdfToSign = await this.addSignatureField(pdfBuffer);
      }

      // 5. Create P12 for signing (with full chain)
      console.log('✍️  Creating signature...');
      const p12Buffer = this.createP12ForSigning(certInfo);

      // 6. Sign PDF
      const signedPdf = signer.sign(pdfToSign, p12Buffer, {
        passphrase: 'temp_signing_pass',
        asn1StrictParsing: false,
      });

      // 7. Save
      const outputPath = dto.pdfPath.replace('.pdf', '_signed.pdf');
      await fs.writeFile(outputPath, signedPdf);
      console.log(`✅ Signed PDF: ${outputPath}`);

      // 8. Export Root CA
      const rootCaPath = await this.exportRootCA(certInfo);

      return {
        success: true,
        message: 'PDF signed successfully',
        outputPath,
        signatureInfo: {
          signer: certInfo.subjectCN,
          timestamp: dto.tsaUrl ? new Date().toISOString() : undefined,
          certificateChain: certInfo.certificateChain.length + 1,
          isValid: true,
        },
        rootCaCertPath: rootCaPath,
        instructions: this.generateInstructions(certInfo.subjectCN, rootCaPath),
      };
    } catch (error: any) {
      console.error('❌ Error:', error);
      throw new BadRequestException(`Failed to sign PDF: ${error.message}`);
    }
  }

  private validateInputFiles(dto: FixSignatureDto): void {
    if (!fsSync.existsSync(dto.pdfPath)) {
      throw new NotFoundException(`PDF not found: ${dto.pdfPath}`);
    }

    if (!dto.certificatePath) {
      throw new BadRequestException('Certificate path is required');
    }

    if (!fsSync.existsSync(dto.certificatePath)) {
      throw new NotFoundException(
        `Certificate not found: ${dto.certificatePath}`,
      );
    }

    if (!dto.password) {
      throw new BadRequestException('Certificate password is required');
    }
  }

  /**
   * Load P12 file and extract keys + certs
   */
  private loadP12Certificate(
    certPath: string,
    password: string,
  ): CertificateInfo {
    try {
      const p12Buffer = fsSync.readFileSync(certPath);
      const p12Der = p12Buffer.toString('binary');
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Get private key
      const keyBags = p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
      });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

      if (!keyBag?.key) {
        throw new Error('Private key not found in P12');
      }

      // Get certificates
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];

      if (!certBag || certBag.length === 0) {
        throw new Error('Certificate not found in P12');
      }

      const certificate = certBag[0].cert;
      const certificateChain: any[] = [];

      // Collect intermediate and root CAs
      for (let i = 1; i < certBag.length; i++) {
        certificateChain.push(certBag[i].cert);
      }

      const cnAttr = certificate.subject.getField('CN');
      const subjectCN = cnAttr ? cnAttr.value : 'Unknown';

      return {
        privateKey: keyBag.key,
        certificate,
        certificateChain,
        subjectCN,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to load P12: ${error.message}`);
    }
  }

  /**
   * Check if PDF already has signature field
   */
  private hasSignatureField(pdfBuffer: Buffer): boolean {
    const pdfString = pdfBuffer.toString('latin1');
    return pdfString.includes('/Type/Sig') || pdfString.includes('/Signature');
  }

  /**
   * Add signature field to PDF
   */
  private async addSignatureField(pdfBuffer: Buffer): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFDocument, PDFName, PDFDict, PDFRef } = require('pdf-lib');

    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      updateMetadata: false,
    });

    const sigDict = pdfDoc.context.obj({
      FT: PDFName.of('Sig'),
      T: '(Signature1)',
      V: PDFRef.of(0),
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Widget'),
      Rect: [0, 0, 0, 0],
      P: pdfDoc.getPages()[0].ref,
    });

    const sigRef = pdfDoc.context.register(sigDict);

    pdfDoc.catalog.set(
      PDFName.of('AcroForm'),
      pdfDoc.context.obj({
        SigFlags: 3,
        Fields: [sigRef],
      }),
    );

    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(pdfBytes);
  }

  /**
   * Create P12 buffer for node-signpdf (with full certificate chain)
   */
  private createP12ForSigning(certInfo: CertificateInfo): Buffer {
    // Create new P12 with full chain
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      certInfo.privateKey,
      [certInfo.certificate, ...certInfo.certificateChain],
      'temp_signing_pass',
      {
        algorithm: '3des',
      },
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    return Buffer.from(p12Der, 'binary');
  }

  /**
   * Export Root CA for manual trust
   */
  private async exportRootCA(
    certInfo: CertificateInfo,
  ): Promise<string | undefined> {
    if (certInfo.certificateChain.length === 0) {
      return undefined;
    }

    try {
      // Last cert in chain is root
      const rootCA =
        certInfo.certificateChain[certInfo.certificateChain.length - 1];
      const rootCAPem = forge.pki.certificateToPem(rootCA);

      const dir = path.join(process.cwd(), 'certificates');
      const filePath = path.join(dir, 'Root_CA_for_Adobe.cer');

      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(filePath, rootCAPem);
      console.log(`📜 Root CA: ${filePath}`);

      return filePath;
    } catch (error: any) {
      console.warn(`⚠️  Root CA export failed: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Generate instructions for user
   */
  private generateInstructions(signer: string, rootCaPath?: string): string[] {
    const instructions = [
      '✅ PDF has been signed successfully',
      '',
      '📋 TO VERIFY IN ADOBE READER:',
      '',
    ];

    if (rootCaPath) {
      instructions.push(
        '1. Import Root CA to Adobe Trusted Certificates:',
        '   • Open Adobe Reader',
        '   • Edit → Preferences → Signatures',
        '   • Identities & Trusted Certificates → More',
        '   • Trusted Certificates → Import',
        `   • Select: ${rootCaPath}`,
        '   • Check: "Use this certificate as a trusted root"',
        '   • Check: "Certified Documents"',
        '   • OK',
        '',
        '2. Restart Adobe Reader',
        '',
        '3. Open signed PDF',
        '',
        'You should see:',
        `   ✅ Signature is valid`,
        `   ✅ Signed by: ${signer}`,
        '   ✅ Document has not been modified',
        '',
      );
    }

    return instructions;
  }
}
