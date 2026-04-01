import type {
  Align,
  Underline,
  BarcodeType,
  HriPosition,
  QRErrorCorrection,
  CutType,
} from './types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const ALIGN_MAP: Record<Align, number> = { left: 0, center: 1, right: 2 };
const UNDERLINE_MAP: Record<Underline, number> = {
  none: 0,
  single: 1,
  double: 2,
};
const CUT_MAP: Record<CutType, number> = { full: 0, partial: 1 };
const BARCODE_MAP: Record<BarcodeType, number> = {
  upc_a: 65,
  upc_e: 66,
  ean13: 67,
  ean8: 68,
  code39: 69,
  itf: 70,
  codabar: 71,
  code93: 72,
  code128: 73,
};
const HRI_MAP: Record<HriPosition, number> = {
  none: 0,
  above: 1,
  below: 2,
  both: 3,
};
const QR_EC_MAP: Record<QRErrorCorrection, number> = {
  L: 48,
  M: 49,
  Q: 50,
  H: 51,
};

export const commands = {
  initialize(): Uint8Array {
    return new Uint8Array([ESC, 0x40]);
  },

  text(content: string): Uint8Array {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(content);
    const result = new Uint8Array(textBytes.length + 1);
    result.set(textBytes);
    result[textBytes.length] = LF;
    return result;
  },

  setAlignment(align: Align): Uint8Array {
    return new Uint8Array([ESC, 0x61, ALIGN_MAP[align]]);
  },

  setBold(on: boolean): Uint8Array {
    return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
  },

  setUnderline(mode: Underline): Uint8Array {
    return new Uint8Array([ESC, 0x2d, UNDERLINE_MAP[mode]]);
  },

  setFontSize(width: number, height: number): Uint8Array {
    const w = Math.max(0, Math.min(7, width - 1));
    const h = Math.max(0, Math.min(7, height - 1));
    return new Uint8Array([GS, 0x21, (w << 4) | h]);
  },

  feedLines(n: number): Uint8Array {
    return new Uint8Array([ESC, 0x64, Math.max(0, Math.min(255, n))]);
  },

  cut(mode: CutType): Uint8Array {
    return new Uint8Array([GS, 0x56, CUT_MAP[mode]]);
  },

  barcode(
    data: string,
    type: BarcodeType,
    height: number,
    width: number,
    showText: HriPosition
  ): Uint8Array {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const cmds: number[] = [
      GS,
      0x68,
      Math.max(1, Math.min(255, height)),
      GS,
      0x77,
      Math.max(2, Math.min(6, width)),
      GS,
      0x48,
      HRI_MAP[showText],
      GS,
      0x6b,
      BARCODE_MAP[type],
      dataBytes.length,
      ...dataBytes,
    ];
    return new Uint8Array(cmds);
  },

  qrCode(
    data: string,
    moduleSize: number,
    errorCorrection: QRErrorCorrection
  ): Uint8Array {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const dataLen = dataBytes.length + 3;
    const pL = dataLen & 0xff;
    const pH = (dataLen >> 8) & 0xff;
    const cmds: number[] = [
      GS,
      0x28,
      0x6b,
      0x04,
      0x00,
      0x31,
      0x41,
      0x32,
      0x00,
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x43,
      Math.max(1, Math.min(16, moduleSize)),
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x45,
      QR_EC_MAP[errorCorrection],
      GS,
      0x28,
      0x6b,
      pL,
      pH,
      0x31,
      0x50,
      0x30,
      ...dataBytes,
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x51,
      0x30,
    ];
    return new Uint8Array(cmds);
  },

  imageRasterHeader(widthBytes: number, heightDots: number): Uint8Array {
    return new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      heightDots & 0xff,
      (heightDots >> 8) & 0xff,
    ]);
  },

  openCashDrawer(pin: 0 | 1): Uint8Array {
    return new Uint8Array([ESC, 0x70, pin, 0x19, 0xff]);
  },
};

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
