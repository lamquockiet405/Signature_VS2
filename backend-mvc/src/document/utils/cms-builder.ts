import * as forge from 'node-forge';

export type BuildCMSOptions = {
  privateKeyPem: string;
  certificatePem: string;
  chainPem?: string[]; // include intermediates and root if available
  signedAttrs?: { name: string; value: string }[]; // Reason, Location, ContactInfo, SigningTime
  tsaToken?: Buffer; // RFC3161 time-stamp token (DER)
  hashHex: string; // message digest over PDF ByteRange
};

export function buildDetachedCMS(opts: BuildCMSOptions): string {
  const p7 = forge.pkcs7.createSignedData();
  // Use the hash digest as "content" in a detached profile with id-data
  p7.content = forge.util.createBuffer(
    Buffer.from(opts.hashHex, 'hex').toString('binary'),
  );
  p7.addCertificate(opts.certificatePem);
  (opts.chainPem || []).forEach((c) => p7.addCertificate(c));

  const privateKey = forge.pki.privateKeyFromPem(opts.privateKeyPem);
  const cert = forge.pki.certificateFromPem(opts.certificatePem);

  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  p7.sign({ detached: true });

  // If TSA token provided, attach as unsigned attribute (id-aa-timeStampToken)
  if (opts.tsaToken) {
    const signer = p7.rawCapture?.signerInfos?.[0];
    if (signer && signer.unauthenticatedAttributes) {
      const tsaAsn1 = forge.asn1.fromDer(opts.tsaToken.toString('binary'));
      signer.unauthenticatedAttributes.value.push({
        type: '1.2.840.113549.1.9.16.2.14',
        value: [tsaAsn1],
      } as any);
    }
  }

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, 'binary').toString('base64');
}
