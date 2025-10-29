import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../../database/database.service';
import { FilteredLogHelper } from '../../common/helpers/filtered-log.helper';
import { SignRequestDto } from '../dtos/sign-request.dto';
import {
  addMetadataAndPlaceholder,
  addSignaturePlaceholder,
  computeDigestExcludingContents,
  embedCMSSignature,
  finalizeByteRange,
  extractCertificateInfo,
  validatePdfSignature,
} from '../utils/pdf-utils';
import { addMetadataToSignature } from '../utils/pdf-metadata-injection';
import { HsmClient } from '../utils/hsm-client';
import * as path from 'path';
import { P12SignPdfRequestDto } from '../dtos/p12-sign-request.dto';
import { loadP12, requestTimestamp } from '../utils/p12-and-tsa';
import {
  preparePdfWithField,
  computePdfHashForCMS,
  injectCMS,
} from '../utils/pdf-signer';
import { buildDetachedCMS } from '../utils/cms-builder';

type SignPdfResult = {
  status: 'success';
  message: string;
  fileUrl: string;
  originalPath: string;
  signedPath: string;
  signedFileName: string;
  signature: string;
  signedAt: string;
  logId: string;
  hash: string;
  certificateInfo: ReturnType<typeof extractCertificateInfo>;
};

type FilePathRow = {
  path: string | null;
  original_name?: string | null;
};

// Minimal internal helper types (used inline for stronger typing)
type InsertedLogRow = { id: string };

@Injectable()
export class DigitalSignatureService {
  constructor(private readonly db: DatabaseService) {}

  private async resolvePath(documentId: string): Promise<string> {
    console.log('🔍 Resolving path for document ID:', documentId);
    const res = await this.db.query<FilePathRow>(
      'SELECT id, path FROM files WHERE id = $1',
      [documentId],
    );
    if (res.rows.length === 0) {
      console.error('❌ Document not found in database:', documentId);
      throw new NotFoundException('Document not found');
    }

    const fileInfo = res.rows[0];
    const p = fileInfo?.path ?? '';
    console.log('📁 File path from DB:', p);

    // Extract filename from path
    const fileName = p.split('/').pop() || '';

    // Try different path variations
    const pathsToTry = [
      p.startsWith('/uploads/') ? `.${p}` : p, // ./uploads/xxx.pdf
      `./uploads/${fileName}`, // ./uploads/filename
      `uploads/${fileName}`, // uploads/filename
    ];

    console.log('🔍 Trying paths:', pathsToTry);

    const fs = await import('fs');
    for (const testPath of pathsToTry) {
      if (fs.existsSync(testPath)) {
        console.log('✅ File exists at:', testPath);
        return testPath;
      }
    }

    console.error('❌ File not found at any expected location');
    throw new NotFoundException(
      `File not found. Document may have been deleted. Path in DB: ${p}`,
    );
  }

  private async readFile(filePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return fs.readFile(filePath);
  }

  private async writeFile(filePath: string, data: Buffer): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, data);
  }

  /**
   * Sign PDF with HSM - Main signing function
   * Integrates with document_signatures table for delegation workflow
   */
  async signPdf(
    dto: Omit<SignRequestDto, 'userId'>,
    userId: string,
  ): Promise<SignPdfResult> {
    // Placeholder text not used directly; we create proper PDF signature placeholder later
    // Handle empty string or undefined keyId - use env default
    const keyId =
      (dto.keyId && dto.keyId.trim()) ||
      process.env.HSM_DEFAULT_KEY_ID ||
      '9504359e-949d-488f-a3e6-53c149e60bab';

    if (!dto.metadata || !dto.metadata.name) {
      throw new BadRequestException(
        'Signature metadata with signer name is required.',
      );
    }

    console.log('🔐 === SIGN PDF REQUEST ===');
    console.log('Document ID:', dto.documentId);
    console.log('Signature Request ID:', dto.signatureRequestId);
    console.log('Key ID:', keyId);
    console.log('Current User ID:', userId);

    try {
      // 1. Get document path
      console.log('Step 1: Resolving document path...');
      const pdfPath = await this.resolvePath(dto.documentId);
      console.log(`📄 Signing document: ${pdfPath}`);

      // 2. Add metadata/visual box first
      const updatedPdf = await addMetadataAndPlaceholder(pdfPath, dto.metadata);

      // 3. Add signature placeholder with visible widget (bottom-right of last page)
      console.log('📋 Adding signature placeholder with visible widget...');
      // Standard A4 page size: 595 x 842 points
      // Bottom-right position: x=300, y=50, width=250, height=100
      const widgetRect: [number, number, number, number] = [300, 50, 550, 150];

      const withPlaceholder = addSignaturePlaceholder(updatedPdf, {
        reason: dto.metadata.reason || 'Digital Signature',
        signatureLength: 16000, // Larger to accommodate certificate chain
        widgetRect: widgetRect,
      });

      // 3.5. Get company info from database
      console.log('🏢 Fetching company information...');
      const companyResult = await this.db.query(
        'SELECT name FROM company LIMIT 1',
      );
      const companyName =
        companyResult.rows.length > 0
          ? companyResult.rows[0].name
          : 'CHUKI System';
      console.log(`✅ Company name: ${companyName}`);

      // 4. Inject metadata WITHOUT changing structure/ByteRange
      console.log('📝 Injecting metadata into signature dictionary...');
      const preparedPdf = addMetadataToSignature(withPlaceholder, {
        name: dto.metadata.name,
        reason: dto.metadata.reason || 'Digital Signature',
        location: dto.metadata.location || 'Vietnam',
        contactInfo: dto.metadata.contact || companyName,
      });

      console.log('✅ Signature field prepared with metadata');

      // 5. Compute digest over ByteRange (excluding /Contents area)
      const hashHex = computeDigestExcludingContents(preparedPdf);
      console.log(
        `🔐 Digest (excluding contents): ${hashHex.substring(0, 16)}...`,
      );

      // 6. Call HSM to sign the digest
      console.log(`🔑 Calling HSM with key: ${keyId}`);
      const cmsBase64 = await HsmClient.signHash(hashHex, keyId);

      // 7. Embed CMS into PDF /Contents
      const withCms = embedCMSSignature(preparedPdf, cmsBase64);
      const finalPdf = finalizeByteRange(withCms);

      // 6. Save signed PDF
      const signedPath = pdfPath.replace('.pdf', '_signed.pdf');
      await this.writeFile(signedPath, finalPdf);
      console.log(`✅ Signed PDF saved: ${signedPath}`);
      const signedFileName = path.basename(signedPath);

      // 7. Extract certificate info
      const certInfo: ReturnType<typeof extractCertificateInfo> =
        extractCertificateInfo(cmsBase64);

      // 8. Log to database
      const logResult = await this.db.query<InsertedLogRow>(
        `INSERT INTO hsm_signedlogs (
          document_id, signature_request_id, signer_name, reason, location, contact,
          hash_value, hash_algorithm, signature_base64, certificate_chain, key_id, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          dto.documentId,
          dto.signatureRequestId || null,
          dto.metadata.name,
          dto.metadata.reason || null,
          dto.metadata.location || null,
          dto.metadata.contact || null,
          hashHex,
          'SHA-256',
          cmsBase64,
          certInfo ? JSON.stringify(certInfo) : null,
          keyId,
          'success',
          JSON.stringify({
            organizationUnit: dto.metadata.organizationUnit,
            organizationName: dto.metadata.organizationName,
            signed_path: signedPath, // Add signed file path to metadata
          }),
        ],
      );

      // 9. Update document_signatures status if this is part of delegation
      if (dto.signatureRequestId) {
        await this.db.query(
          `UPDATE document_signatures 
           SET status = 'signed', 
               signed_at = CURRENT_TIMESTAMP,
               signature_data = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [
            JSON.stringify({
              log_id: logResult.rows[0]?.id,
              hash: hashHex,
              signed_path: signedPath,
            }),
            dto.signatureRequestId,
          ],
        );
        console.log(`✅ Updated signature request: ${dto.signatureRequestId}`);
      }

      // 10. Create log entry
      await FilteredLogHelper.logDocumentSigning(this.db, {
        userId,
        action: 'DOCUMENT_SIGN',
        documentId: dto.documentId,
        documentName: dto.metadata?.name || 'Unknown document',
        signatureMethod: 'HSM',
        metadata: { keyId },
      });

      return {
        status: 'success',
        message: 'Document signed successfully',
        fileUrl: signedPath.startsWith('./')
          ? signedPath.substring(1)
          : signedPath,
        originalPath: pdfPath,
        signedPath: signedPath,
        signedFileName,
        signature: cmsBase64.substring(0, 100) + '...', // Truncate for response
        signedAt: new Date().toISOString(),
        logId: logResult.rows[0]?.id ?? 'unknown',
        hash: hashHex,
        certificateInfo: certInfo,
      };
    } catch (error) {
      const err = error as Error;
      console.error('❌ === SIGN PDF ERROR ===');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);

      // Log error
      try {
        await this.db.query(
          `INSERT INTO hsm_signedlogs (
            document_id, signature_request_id, signer_name, reason, location,
            hash_value, key_id, status, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            dto.documentId,
            dto.signatureRequestId || null,
            dto.metadata.name,
            dto.metadata.reason || null,
            dto.metadata.location || null,
            'error',
            keyId,
            'failed',
            err.message,
          ],
        );
      } catch (logError) {
        console.error('Failed to log error to database:', logError);
      }

      throw new BadRequestException(`Failed to sign document: ${err.message}`);
    }
  }

  /**
   * Sign a PDF by file path using P12 or HSM with TSA and full chain embedding.
   * Ensures placeholder field "Signature1", metadata, and CMS embedding that Adobe accepts.
   */
  async signPdfByPath(body: P12SignPdfRequestDto) {
    const fs = await import('fs/promises');
    const exists = await fs
      .access(body.filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) throw new BadRequestException('filePath not found');

    const originalBytes = await fs.readFile(body.filePath);

    // 1) Normalize and add placeholder widget
    const prepared = await preparePdfWithField(originalBytes, {
      fieldName: body.fieldName || 'Signature1',
      visible: true,
    });

    // 2) Compute hash over ByteRange
    const hashHex = computePdfHashForCMS(prepared);

    // 3) Build CMS using either P12 or HSM
    let cmsBase64: string;
    let signerName = 'Unknown';

    if (body.certificatePath && body.password) {
      const p12 = loadP12(body.certificatePath, body.password);

      // Optional TSA
      let tsaToken: Buffer | undefined;
      if (body.tsaUrl) {
        tsaToken = await requestTimestamp(
          body.tsaUrl,
          Buffer.from(hashHex, 'hex'),
        );
      }

      cmsBase64 = buildDetachedCMS({
        privateKeyPem: p12.privateKeyPem,
        certificatePem: p12.certificatePem,
        chainPem: p12.chainPem,
        hashHex,
        tsaToken,
      });
      signerName = p12.subjectCN || signerName;
    } else if (body.hsmKeyId) {
      cmsBase64 = await HsmClient.signHash(hashHex, body.hsmKeyId);
    } else {
      throw new BadRequestException(
        'Either (certificatePath,password) or hsmKeyId is required',
      );
    }

    // 4) Embed CMS into PDF
    const finalPdf = injectCMS(prepared, cmsBase64);

    // 5) Persist alongside original path
    const signedPath = body.filePath.replace(/\.pdf$/i, '_signed.pdf');
    await fs.writeFile(signedPath, finalPdf);

    return {
      status: 'success',
      message: 'PDF signed successfully',
      originalPath: body.filePath,
      signedPath,
      signer: signerName,
      hash: hashHex,
    };
  }

  /**
   * Verify PDF signature
   */
  async verify(documentId: string) {
    try {
      const pdfPath = await this.resolvePath(documentId);

      // Check PDF for signatures
      const validationResult = await validatePdfSignature(pdfPath);

      // Get signing logs from database
      const logsResult = await this.db.query<{
        status: string;
        signer_name: string | null;
        reason: string | null;
        location: string | null;
        signed_at: Date | null;
        hash_value: string | null;
        hash_algorithm: string | null;
        certificate_chain: string | null;
      }>(
        `SELECT * FROM hsm_signedlogs 
         WHERE document_id = $1 
         ORDER BY signed_at DESC 
         LIMIT 1`,
        [documentId],
      );

      if (logsResult.rows.length === 0) {
        return {
          isValid: false,
          isSigned: validationResult.isSigned,
          message: 'No signing records found',
        };
      }

      const log = logsResult.rows[0];
      interface CertChainShape {
        subject?: unknown[];
        issuer?: unknown[];
        validFrom?: string;
        validTo?: string;
      }
      let certChain: CertChainShape | null = null;
      if (log.certificate_chain && typeof log.certificate_chain === 'string') {
        try {
          const parsed = JSON.parse(log.certificate_chain) as CertChainShape;
          certChain = parsed;
        } catch {
          console.warn('Failed to parse certificate_chain JSON');
        }
      }

      return {
        isValid: log.status === 'success',
        isSigned: validationResult.isSigned,
        signer: log.signer_name ?? undefined,
        reason: log.reason ?? undefined,
        location: log.location ?? undefined,
        signedAt: log.signed_at ?? undefined,
        hash: log.hash_value ?? undefined,
        algorithm: log.hash_algorithm ?? undefined,
        certificateInfo: certChain
          ? {
              subject: Array.isArray(certChain.subject)
                ? certChain.subject
                : [],
              issuer: Array.isArray(certChain.issuer) ? certChain.issuer : [],
              validFrom: certChain.validFrom,
              validTo: certChain.validTo,
            }
          : null,
      };
    } catch (error) {
      const err = error as Error;
      throw new NotFoundException(`Failed to verify document: ${err.message}`);
    }
  }

  /**
   * Get signing history for a document
   */
  async getSigningHistory(documentId: string) {
    const result = await this.db.query(
      `SELECT id, signer_name, reason, location, signed_at, status, hash_value
       FROM hsm_signedlogs 
       WHERE document_id = $1 
       ORDER BY signed_at DESC`,
      [documentId],
    );

    return {
      documentId,
      signatures: result.rows,
      count: result.rows.length,
    };
  }

  /**
   * Get signing statistics
   */
  async getStats(period: string = 'week') {
    let dateFilter = "signed_at >= NOW() - INTERVAL '7 days'";
    if (period === 'month') {
      dateFilter = "signed_at >= NOW() - INTERVAL '30 days'";
    } else if (period === 'year') {
      dateFilter = "signed_at >= NOW() - INTERVAL '1 year'";
    }

    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(DISTINCT document_id) as unique_documents
       FROM hsm_signedlogs
       WHERE ${dateFilter}`,
      [],
    );

    return result.rows[0];
  }

  /**
   * Download signed PDF file
   */
  async downloadSignedPdf(documentId: string, res: Response) {
    try {
      console.log('📥 Download request for document:', documentId);

      const signatureRecord = await this.db.query(
        `SELECT signature_data
           FROM document_signatures
          WHERE document_id = $1 AND status = 'signed'
          ORDER BY signed_at DESC
          LIMIT 1`,
        [documentId],
      );

      let signedPath: string | undefined;
      if (signatureRecord.rows.length > 0) {
        const signatureData = signatureRecord.rows[0].signature_data as {
          signed_path?: string;
        } | null;
        signedPath = signatureData?.signed_path;
      }

      if (!signedPath) {
        const logsResult = await this.db.query(
          `SELECT signature_base64, hash_value, metadata
             FROM hsm_signedlogs
            WHERE document_id = $1 AND status = 'success'
            ORDER BY signed_at DESC
            LIMIT 1`,
          [documentId],
        );

        if (logsResult.rows.length === 0) {
          throw new NotFoundException(
            'No signed version found for this document',
          );
        }

        const originalPath = await this.resolvePath(documentId);
        signedPath = originalPath.replace(/\.pdf$/i, '_signed.pdf');
      }

      if (!signedPath) {
        throw new NotFoundException('Signed file path could not be determined');
      }

      const fs = await import('fs');
      if (!fs.existsSync(signedPath)) {
        console.error('❌ Signed file not found at:', signedPath);
        throw new NotFoundException('Signed file not found on disk');
      }

      const fileResult = await this.db.query<{ original_name: string | null }>(
        'SELECT original_name FROM files WHERE id = $1',
        [documentId],
      );

      const originalName =
        fileResult.rows[0]?.original_name ?? 'signed-document.pdf';
      const safeOriginal =
        typeof originalName === 'string' ? originalName : 'signed-document.pdf';
      const signedFileName = path.basename(
        safeOriginal.replace(/\.pdf$/i, '_signed.pdf'),
      );

      console.log('✅ Sending file:', signedFileName);

      // Set headers for download (sanitize and support UTF-8 names)
      res.setHeader('Content-Type', 'application/pdf');

      // Sanitize filename for ASCII fallback and build RFC 5987 header
      const asciiFallback = signedFileName
        .replace(/[\r\n\t\0]/g, '') // strip control chars
        .replace(/"/g, '') // strip quotes
        .replace(/[%]/g, '') // strip percent to avoid header parsing issues
        .replace(/[^\x20-\x7E]+/g, '_'); // non-ASCII -> underscore
      const encodedUTF8 = encodeURIComponent(signedFileName);
      const contentDisposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUTF8}`;
      res.setHeader('Content-Disposition', contentDisposition);

      const fileStream = fs.createReadStream(signedPath);
      fileStream.pipe(res);
    } catch (error) {
      const err = error as Error;
      console.error('❌ Download error:', err);
      throw new NotFoundException(
        `Failed to download signed document: ${err.message}`,
      );
    }
  }
}
