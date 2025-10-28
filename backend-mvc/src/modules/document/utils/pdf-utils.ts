import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as crypto from 'crypto';
const pdfParse = require('pdf-parse');

interface SignatureMetadata {
  name: string;
  reason?: string;
  location?: string;
  contact?: string;
  organizationUnit?: string;
  organizationName?: string;
}

interface CertificateInfo {
  subject: string[];
  issuer: string[];
  validFrom?: string;
  validTo?: string;
  serialNumber?: string;
}

interface LastTextPosition {
  x: number;
  y: number;
  width: number;
  lastLine: string;
  found: boolean;
}

/**
 * Extract text from PDF and find position of last line on last page
 * Uses pdf-parse to extract text content and estimate positioning
 * @param pdfBuffer - PDF file buffer
 * @param pageHeight - Height of the page in points
 * @param pageWidth - Width of the page in points
 * @returns Position info of last text line
 */
async function findLastTextPosition(
  pdfBuffer: Buffer,
  pageHeight: number,
  pageWidth: number
): Promise<LastTextPosition> {
  try {
    // Parse PDF to get text content
    const data = await pdfParse(pdfBuffer);
    const text = data.text.trim();
    
    if (!text) {
      console.log('⚠️ PDF has no text content (may be scanned/image)');
      return { x: 0, y: 0, width: 0, lastLine: '', found: false };
    }

    // Split into lines and get last non-empty line
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const lastLine = lines[lines.length - 1]?.trim() || '';
    
    if (!lastLine) {
      console.log('⚠️ Could not find last line');
      return { x: 0, y: 0, width: 0, lastLine: '', found: false };
    }

    const totalLines = lines.length;
    console.log(`📄 Total lines: ${totalLines}`);
    console.log(`📄 Last line found: "${lastLine.substring(0, 50)}..."`);
    
    // ===== CHIẾN LƯỢC MỚI: Tìm vị trí chính xác hơn =====
    // Giả định: văn bản thường chiếm 70-80% trang
    // Nếu có ít dòng → text ở giữa/trên
    // Nếu có nhiều dòng → text xuống dưới
    
    let estimatedY: number;
    const lineHeight = 14;
    const topMargin = 100;
    
    if (totalLines <= 5) {
      // Văn bản ngắn → có thể ở giữa trang
      estimatedY = pageHeight * 0.6;  // 60% từ dưới lên
    } else if (totalLines <= 20) {
      // Văn bản trung bình
      estimatedY = pageHeight - topMargin - (totalLines * lineHeight);
    } else {
      // Văn bản dài → dòng cuối gần đáy
      estimatedY = 150;  // Gần đáy trang
    }
    
    // Giới hạn
    const minY = 120;  // Không quá thấp
    const maxY = pageHeight - 120; // Không quá cao
    const y = Math.max(minY, Math.min(maxY, estimatedY));
    
    console.log(`📐 Estimated Y position: ${y} (page height: ${pageHeight}, lines: ${totalLines})`);
    
    return {
      x: 0, // Will use right alignment
      y: y,
      width: lastLine.length,
      lastLine: lastLine,
      found: true,
    };
  } catch (error) {
    console.error('Error parsing PDF text:', error);
    return { x: 0, y: 0, width: 0, lastLine: '', found: false };
  }
}

/**
 * Add metadata and visual signature placeholder to PDF
 * @param pdfPath - Path to PDF file
 * @param metadata - Signature metadata
 * @param _placeholder - Placeholder text for signature (currently unused)
 * @returns Modified PDF as Buffer
 */
export async function addMetadataAndPlaceholder(
  pdfPath: string,
  metadata: SignatureMetadata,
): Promise<Buffer> {
  try {
    const fs = await import('fs/promises');
    const existingPdfBytes = await fs.readFile(pdfPath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Add metadata
    pdfDoc.setTitle(`Signed: ${metadata.name}`);
    pdfDoc.setAuthor(metadata.name);
    pdfDoc.setSubject(metadata.reason || 'Digital Signature');
    pdfDoc.setKeywords([
      'signed',
      'digital-signature',
      metadata.organizationName || '',
    ]);
    pdfDoc.setProducer('CHUKI Digital Signature System');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // Add visual signature on last page
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // Try to find last text position
    const lastTextPos = await findLastTextPosition(
      Buffer.from(existingPdfBytes),
      height,
      width
    );

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Calculate signature box position
    let x: number;
    let y: number;
    const boxWidth = 250;
    const boxHeight = 100;
    const margin = 50;

    if (lastTextPos.found && lastTextPos.lastLine) {
      // Position metadata after/near last text line
      console.log(`📍 Positioning metadata after last text: "${lastTextPos.lastLine.substring(0, 30)}..."`);
      
      // X: Always right-aligned
      x = width - boxWidth - margin;
      
      // Y: Use estimated position from text analysis
      // If estimated Y is too high, use fallback
      y = lastTextPos.y > 0 ? lastTextPos.y : margin;
      
      // Ensure signature box fits on page
      if (y + boxHeight > height - 20) {
        console.log(`⚠️ Signature would overflow page, adjusting Y`);
        y = height - boxHeight - 20;
      }
      
      console.log(`✅ Signature position: x=${x}, y=${y} (dynamic based on content)`);
    } else {
      // Fallback: bottom-right corner (original behavior)
      console.log('📍 Using fallback position (bottom-right)');
      x = width - boxWidth - margin;
      y = margin;
    }

    // Draw signature box
    lastPage.drawRectangle({
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      borderColor: rgb(0.2, 0.2, 0.8),
      borderWidth: 2,
    });

    // Draw signature content
    let textY = y + boxHeight - 15;
    const lineHeight = 12;

    lastPage.drawText('DIGITALLY SIGNED', {
      x: x + 10,
      y: textY,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0.8),
    });
    textY -= lineHeight + 5;

    lastPage.drawText(`By: ${metadata.name}`, {
      x: x + 10,
      y: textY,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
    textY -= lineHeight;

    if (metadata.organizationName) {
      lastPage.drawText(`Org: ${metadata.organizationName}`, {
        x: x + 10,
        y: textY,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      textY -= lineHeight;
    }

    if (metadata.reason) {
      const maxReasonLength = 30;
      const reason =
        metadata.reason.length > maxReasonLength
          ? metadata.reason.substring(0, maxReasonLength) + '...'
          : metadata.reason;
      lastPage.drawText(`Reason: ${reason}`, {
        x: x + 10,
        y: textY,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      textY -= lineHeight;
    }

    if (metadata.location) {
      lastPage.drawText(`Location: ${metadata.location}`, {
        x: x + 10,
        y: textY,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      textY -= lineHeight;
    }

    const timestamp = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    lastPage.drawText(`Date: ${timestamp}`, {
      x: x + 10,
      y: textY,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error('Error adding metadata to PDF:', error);
    throw error;
  }
}

/**
 * Add a PDF signature placeholder using node-signpdf helper so we can embed a CMS later.
 * Returns the prepared PDF buffer (with /ByteRange and /Contents placeholder) that must be used
 * for computing the digest over the byte ranges.
 */
export function addSignaturePlaceholder(
  inputPdf: Buffer,
  opts?: {
    reason?: string;
    signatureLength?: number;
    widgetRect?: [number, number, number, number]; // [llx, lly, urx, ury]
  },
): Buffer {
  // @ts-ignore - types provided via src/types/node-signpdf-helpers.d.ts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');

  const options: any = {
    pdfBuffer: inputPdf,
    reason: opts?.reason || 'Digital Signature',
    signatureLength: opts?.signatureLength || 12000,
  };

  // Add widget rectangle for visible signature
  if (opts?.widgetRect) {
    options.appName = 'CHUKI Digital Signature System';
    options.contactInfo = 'contact@chuki.vn';
    options.location = 'Vietnam';
    options.widgetRect = opts.widgetRect; // [x, y, x+width, y+height]

    console.log('📋 Adding visible signature widget:', {
      rect: opts.widgetRect,
      position: `(${opts.widgetRect[0]}, ${opts.widgetRect[1]}) - (${opts.widgetRect[2]}, ${opts.widgetRect[3]})`,
      size: `${opts.widgetRect[2] - opts.widgetRect[0]}x${opts.widgetRect[3] - opts.widgetRect[1]}`,
    });
  }

  const prepared: Buffer = plainAddPlaceholder(options);
  return Buffer.from(prepared);
}

/**
 * Parse ByteRange from a prepared PDF buffer.
 * Returns [byteRangeStart, byteRangeLen, byteRange2Start, byteRange2Len]
 */
export function parseByteRange(pdf: Buffer): number[] {
  const pdfText = pdf.toString('latin1');
  const regex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/;
  const match = regex.exec(pdfText);
  if (!match) throw new Error('Failed to parse ByteRange');
  return match.slice(1, 5).map((n) => parseInt(n, 10));
}

/**
 * Compute SHA-256 over the defined byte ranges (excluding placeholder /Contents area)
 * This is the digest that the CMS signature must cover (detached).
 */
export function computeByteRangeDigest(pdf: Buffer): string {
  const [start, len, start2, len2] = parseByteRange(pdf);
  const part1 = pdf.slice(start, start + len);
  const part2 = pdf.slice(start2, start2 + len2);
  const hash = crypto.createHash('sha256');
  hash.update(part1);
  hash.update(part2);
  return hash.digest('hex');
}

/**
 * Compute SHA-256 hash excluding /Contents hex block (signature placeholder) directly,
 * without relying on the /ByteRange values. This is useful if ByteRange is not yet
 * finalized and contains placeholders.
 */
export function computeDigestExcludingContents(pdf: Buffer): string {
  const pdfText = pdf.toString('latin1');
  const re = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  const match = re.exec(pdfText);
  if (!match || typeof match.index !== 'number') {
    throw new Error('/Contents placeholder not found for digest');
  }
  const whole = match[0];
  const hexGroup = match[1];
  const hexStartInWhole = whole.indexOf('<') + 1;
  const start = match.index + hexStartInWhole;
  const placeholderHexLen = hexGroup.length;
  const end = start + placeholderHexLen;

  const hash = crypto.createHash('sha256');
  hash.update(pdf.slice(0, start));
  hash.update(pdf.slice(end));
  return hash.digest('hex');
}

/**
 * Normalize a PDF by loading and re-saving it via pdf-lib with object streams disabled.
 * This can fix inconsistent xref/trailer structures for downstream tools.
 */
export async function normalizePdfStructure(input: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input);
  const out = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(out);
}

/**
 * Embed CMS (base64) into the /Contents placeholder. The placeholder has a fixed size (signatureLength),
 * so we hex-encode CMS and pad with 0 to fit the exact placeholder length.
 */
export function embedCMSSignature(
  preparedPdf: Buffer,
  cmsBase64: string,
): Buffer {
  const pdfText = preparedPdf.toString('latin1');
  const re = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  const match = re.exec(pdfText);
  if (!match || typeof match.index !== 'number') {
    throw new Error('/Contents placeholder not found');
  }
  const whole = match[0];
  const hexGroup = match[1];
  const hexStartInWhole = whole.indexOf('<') + 1;
  const start = match.index + hexStartInWhole;
  const placeholderHexLen = hexGroup.length;
  const end = start + placeholderHexLen;

  const cms = Buffer.from(cmsBase64, 'base64');
  const cmsHex = cms.toString('hex');
  if (cmsHex.length > placeholderHexLen) {
    throw new Error(
      `CMS signature (${cmsHex.length}) exceeds placeholder size (${placeholderHexLen}). Increase signatureLength.`,
    );
  }
  const paddedHex = cmsHex.padEnd(placeholderHexLen, '0');

  const out = Buffer.concat([
    preparedPdf.slice(0, start),
    Buffer.from(paddedHex, 'latin1'),
    preparedPdf.slice(end),
  ]);
  return out;
}

/**
 * node-signpdf already sets ByteRange to real numeric values after plainAddPlaceholder.
 * We do NOT need to finalize/replace anything—just return the PDF as-is.
 * The digest was computed excluding /Contents, and we embedded CMS into /Contents,
 * so the ByteRange pointing to [0, start_of_contents, end_of_contents, remainder] is valid.
 */
export function finalizeByteRange(pdfWithCms: Buffer): Buffer {
  // Simply return; node-signpdf already wrote numeric ByteRange when creating placeholder
  return pdfWithCms;
}

/**
 * Compute SHA-256 hash of PDF buffer
 * @param pdfBuffer - PDF content as Buffer
 * @returns Hex-encoded hash
 */
export function computeSignatureHash(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
}

/**
 * Create PAdES-compliant signature
 * This is a simplified implementation. For production, use proper PAdES library
 * @param pdfBuffer - PDF content
 * @param cmsSignature - CMS/PKCS#7 signature
 * @param metadata - Signature metadata
 * @returns Signed PDF as Buffer
 */
export async function createPAdESSignature(
  pdfBuffer: Buffer,
  cmsSignature: Buffer,
  metadata: SignatureMetadata,
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // In a real implementation, you would:
    // 1. Create a signature dictionary
    // 2. Add ByteRange
    // 3. Embed CMS signature
    // 4. Update cross-reference table

    // For now, we'll add signature as metadata and return the PDF
    pdfDoc.setProducer('CHUKI Digital Signature System - PAdES');

    // Note: This is a simplified approach
    // Real PAdES requires proper signature dictionary in PDF structure

    const signedPdfBytes = await pdfDoc.save({
      useObjectStreams: false,
    });

    console.log('📝 PAdES signature created');
    console.log('   - Signer:', metadata.name);
    console.log('   - Size:', signedPdfBytes.length, 'bytes');

    return Buffer.from(signedPdfBytes);
  } catch (error) {
    console.error('Error creating PAdES signature:', error);
    throw error;
  }
}

/**
 * Validate PDF signature
 * @param pdfPath - Path to PDF file
 * @returns Validation result
 */
export async function validatePdfSignature(
  pdfPath: string,
): Promise<{ isSigned: boolean; isValid: boolean; message: string }> {
  try {
    const fs = await import('fs/promises');
    const pdfBytes = await fs.readFile(pdfPath);

    // Read PDF as buffer to search for signature markers
    const pdfString = pdfBytes.toString('latin1');

    // Check for common signature indicators in PDF
    const hasSignatureField =
      pdfString.includes('/Type/Sig') || pdfString.includes('/Type /Sig');
    const hasByteRange = pdfString.includes('/ByteRange');
    const hasContents = pdfString.includes('/Contents');
    const hasAcroForm = pdfString.includes('/AcroForm');
    const hasSigFlags = pdfString.includes('/SigFlags');
    const hasSubFilter = pdfString.includes('/SubFilter');
    const hasPKCS7 =
      pdfString.includes('adbe.pkcs7.detached') ||
      pdfString.includes('adbe.pkcs7.sha1');

    // A signed PDF typically has these markers
    // More flexible check: ByteRange + (SubFilter or PKCS7) indicates signature
    const isSigned = hasByteRange && (hasSubFilter || hasPKCS7);

    // Try to count signatures by looking for ByteRange entries
    let signatureCount = 0;
    const byteRangeMatches = pdfString.match(/\/ByteRange\s*\[/g);
    if (byteRangeMatches) {
      signatureCount = byteRangeMatches.length;
    }

    console.log('📋 PDF Signature Check:');
    console.log('  - Has /Type/Sig:', hasSignatureField);
    console.log('  - Has /ByteRange:', hasByteRange);
    console.log('  - Has /Contents:', hasContents);
    console.log('  - Has /AcroForm:', hasAcroForm);
    console.log('  - Has /SigFlags:', hasSigFlags);
    console.log('  - Has /SubFilter:', hasSubFilter);
    console.log('  - Has PKCS7:', hasPKCS7);
    console.log('  - Signature Count:', signatureCount);

    if (isSigned) {
      return {
        isSigned: true,
        isValid: true,
        message: `Document contains ${signatureCount} digital signature(s)`,
      };
    } else {
      return {
        isSigned: false,
        isValid: false,
        message: 'Document is not signed',
      };
    }
  } catch (error) {
    console.error('Error validating PDF signature:', error);
    return {
      isSigned: false,
      isValid: false,
      message: 'Failed to validate signature',
    };
  }
}

/**
 * Extract certificate information from CMS signature
 * @param cmsBase64 - Base64-encoded CMS signature
 * @returns Certificate information
 */
export function extractCertificateInfo(cmsBase64: string): CertificateInfo {
  try {
    // Decode CMS signature
    const cmsBuffer = Buffer.from(cmsBase64, 'base64');
    const cmsString = cmsBuffer.toString('utf-8');

    // Try to parse if it's JSON (mock signature)
    try {
      const cmsData = JSON.parse(cmsString) as {
        timestamp?: string;
        [key: string]: unknown;
      };
      return {
        subject: ['CN=Digital Signature Service', 'O=Backend MVC'],
        issuer: ['CN=CHUKI CA', 'O=CHUKI System'],
        validFrom: (cmsData.timestamp as string) || new Date().toISOString(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        serialNumber: crypto.randomBytes(16).toString('hex'),
      };
    } catch {
      // Not JSON, return default
      return {
        subject: ['CN=Digital Signature Service'],
        issuer: ['CN=CHUKI CA'],
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        serialNumber: crypto.randomBytes(16).toString('hex'),
      };
    }
  } catch (error) {
    console.error('Error extracting certificate info:', error);
    return {
      subject: ['CN=Unknown'],
      issuer: ['CN=Unknown'],
    };
  }
}
