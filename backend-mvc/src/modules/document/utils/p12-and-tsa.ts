import * as forge from 'node-forge';
import axios from 'axios';
import { fromBER } from 'asn1js';

export type LoadedP12 = {
  privateKeyPem: string;
  certificatePem: string;
  chainPem: string[]; // includes end-entity first, then intermediates, root last if present
  subjectCN?: string;
};

export function loadP12(p12Path: string, password: string): LoadedP12 {
  const fs = require('fs');
  const p12Der = fs.readFileSync(p12Path);
  const p12Asn1 = forge.asn1.fromDer(p12Der.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const bagsKey = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  const bagsShrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const keyBag = [...bagsKey, ...bagsShrouded][0];
  if (!keyBag) throw new Error('Private key not found in P12');
  const privateKey = keyBag.key;
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!certBags.length) throw new Error('Certificate not found in P12');

  // First bag is typically end-entity; ensure by picking with private key localKeyId if available
  const endEntity = certBags[0].cert as forge.pki.Certificate;
  const certificatePem = forge.pki.certificateToPem(endEntity);
  const chainPem: string[] = certBags.map((b: any) => forge.pki.certificateToPem(b.cert));

  const subjectCN = endEntity.subject.getField('CN')?.value;

  return { privateKeyPem, certificatePem, chainPem, subjectCN };
}

export async function requestTimestamp(tsaUrl: string, messageImprintSha256: Buffer): Promise<Buffer> {
  // Minimal RFC 3161 TSA request: use a pre-built DER if available; otherwise, rely on TSA echo JSON if using demo TSA
  // Here we send raw hash as hex to TSA expecting CMS time-stamp token base64
  const res = await axios.post(tsaUrl, { hash: messageImprintSha256.toString('hex'), alg: 'sha256' }, { timeout: 20000 });
  if (!res.data) throw new Error('Invalid TSA response');
  // Accept base64 token or raw DER in hex
  if (typeof res.data.token === 'string') {
    return Buffer.from(res.data.token, 'base64');
  }
  if (typeof res.data.der === 'string') {
    return Buffer.from(res.data.der, 'hex');
  }
  // Fallback: if server returns base64 directly
  if (typeof res.data === 'string') {
    return Buffer.from(res.data, 'base64');
  }
  throw new Error('Unsupported TSA response format');
}


