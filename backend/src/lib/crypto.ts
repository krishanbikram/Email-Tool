import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.AES_SECRET_KEY;

if (!SECRET || SECRET.length !== 32) {
  throw new Error('AES_SECRET_KEY must be exactly 32 characters in .env');
}

const KEY = Buffer.from(SECRET, 'utf-8');

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(encoded: string): string {
  const [ivHex, encryptedHex] = encoded.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}
