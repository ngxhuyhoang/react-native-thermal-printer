const CP1252_UNDEFINED = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

export function isCP1252Compatible(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) return false;
    if (CP1252_UNDEFINED.has(code)) return false;
  }
  return true;
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < len ? bytes[i + 1]! : 0;
    const b2 = i + 2 < len ? bytes[i + 2]! : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (base64.length === 0) return new Uint8Array([]);

  const lookup = new Uint8Array(128);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }

  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;

  const byteLength = (base64.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);

  let j = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const a = lookup[base64.charCodeAt(i)]!;
    const b = lookup[base64.charCodeAt(i + 1)]!;
    const c = lookup[base64.charCodeAt(i + 2)]!;
    const d = lookup[base64.charCodeAt(i + 3)]!;
    bytes[j++] = (a << 2) | (b >> 4);
    if (j < byteLength) bytes[j++] = ((b & 0x0f) << 4) | (c >> 2);
    if (j < byteLength) bytes[j++] = ((c & 0x03) << 6) | d;
  }
  return bytes;
}
