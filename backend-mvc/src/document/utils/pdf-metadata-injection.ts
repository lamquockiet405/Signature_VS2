/**
 * Add metadata to signature dictionary by direct byte manipulation
 * This preserves ByteRange integrity while adding signer info
 */
export function addMetadataToSignature(
  pdfBuffer: Buffer,
  metadata: {
    name: string;
    reason?: string;
    location?: string;
    contactInfo?: string;
  },
): Buffer {
  let pdfText = pdfBuffer.toString('latin1');

  // Find signature dictionary
  const sigDictRegex = /<<\s*(\/Type\s*\/Sig[^>]+)>>/;
  const match = sigDictRegex.exec(pdfText);

  if (!match) {
    console.warn(
      '⚠️ Could not find signature dictionary, returning unchanged PDF',
    );
    return pdfBuffer;
  }

  const sigDictContent = match[1];
  const sigDictStart = match.index;
  const sigDictEnd = sigDictStart + match[0].length;

  // Create metadata entries in PDF format
  const now = new Date();
  const pdfDate = formatPDFDate(now);

  // Build new signature dictionary with metadata
  let newSigDict = sigDictContent;

  // Add Name (signer)
  const nameHex = stringToHex(metadata.name);
  if (!newSigDict.includes('/Name')) {
    newSigDict += `/Name<${nameHex}>`;
  }

  // Add Reason
  if (metadata.reason && !newSigDict.includes('/Reason')) {
    const reasonHex = stringToHex(metadata.reason);
    newSigDict += `/Reason<${reasonHex}>`;
  }

  // Add Location
  if (metadata.location && !newSigDict.includes('/Location')) {
    const locationHex = stringToHex(metadata.location);
    newSigDict += `/Location<${locationHex}>`;
  }

  // Add ContactInfo
  if (metadata.contactInfo && !newSigDict.includes('/ContactInfo')) {
    const contactHex = stringToHex(metadata.contactInfo);
    newSigDict += `/ContactInfo<${contactHex}>`;
  }

  // Add signing time (M = Modification date)
  if (!newSigDict.includes('/M')) {
    const dateHex = stringToHex(pdfDate);
    newSigDict += `/M<${dateHex}>`;
  }

  // Replace old signature dictionary with new one
  const newSigDictFull = `<<${newSigDict}>>`;
  pdfText =
    pdfText.substring(0, sigDictStart) +
    newSigDictFull +
    pdfText.substring(sigDictEnd);

  console.log('✅ Added metadata to signature dictionary:', {
    name: metadata.name,
    reason: metadata.reason,
    location: metadata.location,
    time: pdfDate,
    addedBytes: newSigDictFull.length - match[0].length,
  });

  return Buffer.from(pdfText, 'latin1');
}

/**
 * Convert string to hex format for PDF
 * Uses UTF-16BE encoding with BOM (FEFF)
 */
function stringToHex(str: string): string {
  // Add BOM for UTF-16BE
  const bom = 'FEFF';
  let hex = bom;

  // Convert each character to UTF-16BE hex
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).toUpperCase().padStart(4, '0');
  }

  return hex;
}

/**
 * Format date for PDF (D:YYYYMMDDHHmmSSOHH'mm')
 */
function formatPDFDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Timezone offset
  const tzOffset = -date.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');

  return `D:${year}${month}${day}${hours}${minutes}${seconds}${tzSign}${tzHours}'${tzMinutes}'`;
}
