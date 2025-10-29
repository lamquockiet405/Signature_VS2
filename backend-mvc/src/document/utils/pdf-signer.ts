import {
  addSignaturePlaceholder,
  computeDigestExcludingContents,
  embedCMSSignature,
  finalizeByteRange,
} from './pdf-utils';
import { PDFDocument } from 'pdf-lib';

export async function preparePdfWithField(
  inputPdf: Buffer,
  options?: { fieldName?: string; visible?: boolean },
): Promise<Buffer> {
  // Ensure deterministic structure
  const pdf = await PDFDocument.load(inputPdf);
  const out = await pdf.save({ useObjectStreams: false });
  const placeholder = addSignaturePlaceholder(Buffer.from(out), {
    reason: 'Digital Signature',
    signatureLength: 16000,
  });
  return placeholder;
}

export function computePdfHashForCMS(preparedPdf: Buffer): string {
  return computeDigestExcludingContents(preparedPdf);
}

export function injectCMS(preparedPdf: Buffer, cmsBase64: string): Buffer {
  const withCms = embedCMSSignature(preparedPdf, cmsBase64);
  return finalizeByteRange(withCms);
}
