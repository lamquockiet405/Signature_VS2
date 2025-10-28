declare module 'node-signpdf/dist/helpers' {
  export function plainAddPlaceholder(options: {
    pdfBuffer: Buffer;
    reason?: string;
    signatureLength?: number;
  }): Buffer;
}
