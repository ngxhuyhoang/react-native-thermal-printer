import {
  isCP1252Compatible,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../src/encoding';

describe('isCP1252Compatible', () => {
  it('returns true for ASCII text', () => {
    expect(isCP1252Compatible('Hello World 123')).toBe(true);
  });

  it('returns true for CP1252 extended characters', () => {
    expect(isCP1252Compatible('café résumé naïve')).toBe(true);
  });

  it('returns false for Vietnamese ả (U+1EA3, outside CP1252)', () => {
    expect(isCP1252Compatible('Cảm ơn')).toBe(false);
  });

  it('returns false for Vietnamese ư (U+01B0)', () => {
    expect(isCP1252Compatible('ưu tiên')).toBe(false);
  });

  it('returns false for Vietnamese ơ (U+01A1)', () => {
    expect(isCP1252Compatible('cơm')).toBe(false);
  });

  it('returns false for Vietnamese đ (U+0111)', () => {
    expect(isCP1252Compatible('đồng')).toBe(false);
  });

  it('returns true for Xin chào (à is U+00E0, within CP1252)', () => {
    expect(isCP1252Compatible('Xin chào')).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isCP1252Compatible('')).toBe(true);
  });

  it('returns false for emoji', () => {
    expect(isCP1252Compatible('Hello 😀')).toBe(false);
  });

  it('returns false for CJK characters', () => {
    expect(isCP1252Compatible('漢字')).toBe(false);
  });

  it('returns true for common receipt characters', () => {
    expect(isCP1252Compatible('Item #1 @ $10.00 x 2 = $20.00')).toBe(true);
  });
});

describe('uint8ArrayToBase64', () => {
  it('encodes empty array', () => {
    expect(uint8ArrayToBase64(new Uint8Array([]))).toBe('');
  });

  it('encodes single byte', () => {
    expect(uint8ArrayToBase64(new Uint8Array([0]))).toBe('AA==');
  });

  it('encodes three bytes (no padding)', () => {
    expect(uint8ArrayToBase64(new Uint8Array([0x48, 0x69, 0x21]))).toBe('SGkh');
  });

  it('round-trips with base64ToUint8Array', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    const encoded = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });
});

describe('base64ToUint8Array', () => {
  it('decodes empty string', () => {
    expect(base64ToUint8Array('')).toEqual(new Uint8Array([]));
  });

  it('decodes padded base64', () => {
    expect(base64ToUint8Array('AA==')).toEqual(new Uint8Array([0]));
  });

  it('decodes no-padding base64', () => {
    expect(base64ToUint8Array('SGkh')).toEqual(
      new Uint8Array([0x48, 0x69, 0x21])
    );
  });
});
