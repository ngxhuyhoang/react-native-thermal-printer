# Thermal Printer Library Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the API into a single `ThermalPrinter` class with auto-reconnect, Vietnamese text support, error handling, full test suite, and documentation.

**Architecture:** Single `ThermalPrinter` class wraps internal modules — `commands.ts` (ESC/POS bytes), `encoding.ts` (CP1252 detection + base64), `connection.ts` (native bridge + reconnect + events). Native modules add `renderTextToImage` for Vietnamese support.

**Tech Stack:** React Native 0.83 (TurboModules), TypeScript 5.9, Jest, Android (Kotlin), iOS (Objective-C++)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Rewrite | All types, interfaces, PrinterError class |
| `src/commands.ts` | Create | ESC/POS byte generation (internal) |
| `src/encoding.ts` | Create | CP1252 detection + base64 utilities (internal) |
| `src/connection.ts` | Rewrite | Connection class: native bridge, reconnect, events (internal) |
| `src/ThermalPrinter.ts` | Create (replaces ReceiptBuilder.ts) | Public API class |
| `src/NativeThermalPrinter.ts` | Modify | Add renderTextToImage to spec |
| `src/index.tsx` | Rewrite | Export ThermalPrinter, PrinterError, types |
| `src/escpos.ts` | Delete | Replaced by commands.ts |
| `src/ReceiptBuilder.ts` | Delete | Replaced by ThermalPrinter.ts |
| `__tests__/mocks/NativeThermalPrinter.ts` | Create | Mock native module for tests |
| `__tests__/commands.test.ts` | Create | Unit tests for ESC/POS commands |
| `__tests__/encoding.test.ts` | Create | Unit tests for CP1252 detection |
| `__tests__/connection.test.ts` | Create | Integration tests for reconnect logic |
| `__tests__/ThermalPrinter.test.ts` | Create | Unit tests for main class |
| `android/.../ThermalPrinterModule.kt` | Modify | Add renderTextToImage |
| `ios/ThermalPrinter.mm` | Modify | Add renderTextToImage |
| `example/src/App.tsx` | Rewrite | Demo with new API |
| `README.md` | Rewrite | Full documentation |

---

### Task 1: Define types

**Files:**
- Rewrite: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// src/types.ts

export type PrinterState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type PrinterErrorCode =
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_LOST'
  | 'NOT_CONNECTED'
  | 'SEND_FAILED'
  | 'IMAGE_PROCESSING_FAILED'
  | 'INVALID_DATA';

export class PrinterError extends Error {
  code: PrinterErrorCode;

  constructor(code: PrinterErrorCode, message: string) {
    super(message);
    this.name = 'PrinterError';
    this.code = code;
  }
}

export interface PrinterConfig {
  host: string;
  port?: number;
  timeout?: number;
  autoReconnect?: boolean;
  retryInterval?: number;
  maxRetries?: number;
}

export interface TextOptions {
  bold?: boolean;
  underline?: 'none' | 'single' | 'double';
  align?: 'left' | 'center' | 'right';
  width?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  height?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  forceImageMode?: boolean;
}

export interface QROptions {
  size?: number;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  align?: 'left' | 'center' | 'right';
}

export interface BarcodeOptions {
  type?: 'code128' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'code39' | 'itf' | 'codabar' | 'code93';
  height?: number;
  width?: number;
  showText?: 'none' | 'above' | 'below' | 'both';
  align?: 'left' | 'center' | 'right';
}

export interface ImageOptions {
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export type Align = 'left' | 'center' | 'right';
export type Underline = 'none' | 'single' | 'double';
export type BarcodeType = 'code128' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'code39' | 'itf' | 'codabar' | 'code93';
export type HriPosition = 'none' | 'above' | 'below' | 'both';
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type CutType = 'full' | 'partial';
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn typecheck`
Expected: May have errors in other files (expected — we'll fix them in later tasks)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: rewrite types with string literals and PrinterError class"
```

---

### Task 2: Create test mock

**Files:**
- Create: `__tests__/mocks/NativeThermalPrinter.ts`

- [ ] **Step 1: Write mock module**

```typescript
// __tests__/mocks/NativeThermalPrinter.ts

const mockNativeModule = {
  connect: jest.fn<Promise<void>, [string, number, number]>().mockResolvedValue(undefined),
  disconnect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  isConnected: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
  sendRawData: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  getImageRasterData: jest.fn<Promise<string>, [string, number]>().mockResolvedValue('AA=='),
  renderTextToImage: jest.fn<Promise<string>, [string, number, boolean, number]>().mockResolvedValue('AA=='),
};

export function resetMocks(): void {
  Object.values(mockNativeModule).forEach((fn) => fn.mockClear());
  mockNativeModule.connect.mockResolvedValue(undefined);
  mockNativeModule.disconnect.mockResolvedValue(undefined);
  mockNativeModule.isConnected.mockResolvedValue(true);
  mockNativeModule.sendRawData.mockResolvedValue(undefined);
  mockNativeModule.getImageRasterData.mockResolvedValue('AA==');
  mockNativeModule.renderTextToImage.mockResolvedValue('AA==');
}

export default mockNativeModule;
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/mocks/NativeThermalPrinter.ts
git commit -m "test: add mock native module for unit tests"
```

---

### Task 3: Commands module (TDD)

**Files:**
- Create: `src/commands.ts`
- Create: `__tests__/commands.test.ts`
- Delete: `src/escpos.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/commands.test.ts

import { commands, concatBytes } from '../src/commands';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

describe('commands', () => {
  describe('initialize', () => {
    it('returns ESC @', () => {
      expect(commands.initialize()).toEqual(new Uint8Array([ESC, 0x40]));
    });
  });

  describe('text', () => {
    it('encodes text with LF', () => {
      const result = commands.text('Hi');
      // 'H' = 0x48, 'i' = 0x69
      expect(result).toEqual(new Uint8Array([0x48, 0x69, LF]));
    });
  });

  describe('setAlignment', () => {
    it('maps left to 0', () => {
      expect(commands.setAlignment('left')).toEqual(new Uint8Array([ESC, 0x61, 0]));
    });

    it('maps center to 1', () => {
      expect(commands.setAlignment('center')).toEqual(new Uint8Array([ESC, 0x61, 1]));
    });

    it('maps right to 2', () => {
      expect(commands.setAlignment('right')).toEqual(new Uint8Array([ESC, 0x61, 2]));
    });
  });

  describe('setBold', () => {
    it('enables bold', () => {
      expect(commands.setBold(true)).toEqual(new Uint8Array([ESC, 0x45, 1]));
    });

    it('disables bold', () => {
      expect(commands.setBold(false)).toEqual(new Uint8Array([ESC, 0x45, 0]));
    });
  });

  describe('setUnderline', () => {
    it('maps none to 0', () => {
      expect(commands.setUnderline('none')).toEqual(new Uint8Array([ESC, 0x2d, 0]));
    });

    it('maps single to 1', () => {
      expect(commands.setUnderline('single')).toEqual(new Uint8Array([ESC, 0x2d, 1]));
    });

    it('maps double to 2', () => {
      expect(commands.setUnderline('double')).toEqual(new Uint8Array([ESC, 0x2d, 2]));
    });
  });

  describe('setFontSize', () => {
    it('encodes width=1 height=1 as 0x00', () => {
      expect(commands.setFontSize(1, 1)).toEqual(new Uint8Array([GS, 0x21, 0x00]));
    });

    it('encodes width=2 height=3 as 0x12', () => {
      // (2-1) << 4 | (3-1) = 0x10 | 0x02 = 0x12
      expect(commands.setFontSize(2, 3)).toEqual(new Uint8Array([GS, 0x21, 0x12]));
    });

    it('clamps to 1-8 range', () => {
      // width=8 height=8 => (7 << 4) | 7 = 0x77
      expect(commands.setFontSize(8, 8)).toEqual(new Uint8Array([GS, 0x21, 0x77]));
    });
  });

  describe('feedLines', () => {
    it('feeds n lines', () => {
      expect(commands.feedLines(3)).toEqual(new Uint8Array([ESC, 0x64, 3]));
    });

    it('clamps to 0-255', () => {
      expect(commands.feedLines(300)).toEqual(new Uint8Array([ESC, 0x64, 255]));
    });
  });

  describe('cut', () => {
    it('full cut', () => {
      expect(commands.cut('full')).toEqual(new Uint8Array([GS, 0x56, 0]));
    });

    it('partial cut', () => {
      expect(commands.cut('partial')).toEqual(new Uint8Array([GS, 0x56, 1]));
    });
  });

  describe('barcode', () => {
    it('generates code128 barcode commands', () => {
      const result = commands.barcode('123', 'code128', 100, 3, 'below');
      expect(result[0]).toBe(GS); // height command start
      expect(result[2]).toBe(100); // height value
      expect(result[3]).toBe(GS); // width command start
      expect(result[5]).toBe(3); // width value
      expect(result[6]).toBe(GS); // HRI command start
      expect(result[8]).toBe(2); // HRI below = 2
      expect(result[9]).toBe(GS); // print command start
      expect(result[11]).toBe(73); // Code128 = 73
      expect(result[12]).toBe(3); // data length
    });
  });

  describe('qrCode', () => {
    it('generates QR code commands', () => {
      const result = commands.qrCode('AB', 6, 'M');
      // Check select model prefix
      expect(result[0]).toBe(GS);
      expect(result[1]).toBe(0x28);
      expect(result[2]).toBe(0x6b);
      // Check module size byte (17th byte = index 16)
      expect(result[16]).toBe(6);
      // Check error correction byte (24th byte = index 23)
      expect(result[23]).toBe(49); // 'M' = 49
    });
  });

  describe('imageRasterHeader', () => {
    it('generates raster header', () => {
      const result = commands.imageRasterHeader(48, 100);
      expect(result).toEqual(new Uint8Array([GS, 0x76, 0x30, 0x00, 48, 0, 100, 0]));
    });
  });

  describe('openCashDrawer', () => {
    it('opens pin 0', () => {
      expect(commands.openCashDrawer(0)).toEqual(new Uint8Array([ESC, 0x70, 0, 0x19, 0xff]));
    });

    it('opens pin 1', () => {
      expect(commands.openCashDrawer(1)).toEqual(new Uint8Array([ESC, 0x70, 1, 0x19, 0xff]));
    });
  });
});

describe('concatBytes', () => {
  it('concatenates multiple Uint8Arrays', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    expect(concatBytes(a, b)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('handles empty arrays', () => {
    const a = new Uint8Array([1]);
    const b = new Uint8Array([]);
    expect(concatBytes(a, b)).toEqual(new Uint8Array([1]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/commands.test.ts`
Expected: FAIL — `commands` module doesn't exist yet

- [ ] **Step 3: Write commands.ts**

```typescript
// src/commands.ts

import type { Align, Underline, BarcodeType, HriPosition, QRErrorCorrection, CutType } from './types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const ALIGN_MAP: Record<Align, number> = { left: 0, center: 1, right: 2 };
const UNDERLINE_MAP: Record<Underline, number> = { none: 0, single: 1, double: 2 };
const CUT_MAP: Record<CutType, number> = { full: 0, partial: 1 };
const BARCODE_MAP: Record<BarcodeType, number> = {
  upc_a: 65, upc_e: 66, ean13: 67, ean8: 68, code39: 69,
  itf: 70, codabar: 71, code93: 72, code128: 73,
};
const HRI_MAP: Record<HriPosition, number> = { none: 0, above: 1, below: 2, both: 3 };
const QR_EC_MAP: Record<QRErrorCorrection, number> = { L: 48, M: 49, Q: 50, H: 51 };

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

  barcode(data: string, type: BarcodeType, height: number, width: number, showText: HriPosition): Uint8Array {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const cmds: number[] = [
      GS, 0x68, Math.max(1, Math.min(255, height)),
      GS, 0x77, Math.max(2, Math.min(6, width)),
      GS, 0x48, HRI_MAP[showText],
      GS, 0x6b, BARCODE_MAP[type], dataBytes.length, ...dataBytes,
    ];
    return new Uint8Array(cmds);
  },

  qrCode(data: string, moduleSize: number, errorCorrection: QRErrorCorrection): Uint8Array {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const dataLen = dataBytes.length + 3;
    const pL = dataLen & 0xff;
    const pH = (dataLen >> 8) & 0xff;
    const cmds: number[] = [
      GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize)),
      GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, QR_EC_MAP[errorCorrection],
      GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes,
      GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ];
    return new Uint8Array(cmds);
  },

  imageRasterHeader(widthBytes: number, heightDots: number): Uint8Array {
    return new Uint8Array([
      GS, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      heightDots & 0xff, (heightDots >> 8) & 0xff,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/commands.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Delete old escpos.ts and commit**

```bash
rm src/escpos.ts
git add src/commands.ts __tests__/commands.test.ts
git add src/escpos.ts
git commit -m "refactor: replace escpos.ts with internal commands module (TDD)"
```

---

### Task 4: Encoding module (TDD)

**Files:**
- Create: `src/encoding.ts`
- Create: `__tests__/encoding.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/encoding.test.ts

import { isCP1252Compatible, uint8ArrayToBase64, base64ToUint8Array } from '../src/encoding';

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
    expect(base64ToUint8Array('SGkh')).toEqual(new Uint8Array([0x48, 0x69, 0x21]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/encoding.test.ts`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Write encoding.ts**

```typescript
// src/encoding.ts

// CP1252 undefined code points (0x80-0x9F range holes)
const CP1252_UNDEFINED = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

export function isCP1252Compatible(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) return false;
    if (CP1252_UNDEFINED.has(code)) return false;
  }
  return true;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/encoding.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/encoding.ts __tests__/encoding.test.ts
git commit -m "feat: add encoding module with CP1252 detection and base64 utilities (TDD)"
```

---

### Task 5: Connection module (TDD)

**Files:**
- Rewrite: `src/connection.ts`
- Create: `__tests__/connection.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/connection.test.ts

import mockNative, { resetMocks } from './mocks/NativeThermalPrinter';

jest.mock('../src/NativeThermalPrinter', () => ({
  __esModule: true,
  default: require('./mocks/NativeThermalPrinter').default,
}));

import { Connection } from '../src/connection';
import { PrinterError } from '../src/types';

beforeEach(() => {
  resetMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Connection', () => {
  function createConnection(overrides = {}) {
    return new Connection({
      host: '192.168.1.100',
      port: 9100,
      timeout: 5000,
      autoReconnect: true,
      retryInterval: 3000,
      maxRetries: 3,
      ...overrides,
    });
  }

  describe('connect', () => {
    it('calls native connect and transitions to connected', async () => {
      const conn = createConnection();
      await conn.connect();
      expect(mockNative.connect).toHaveBeenCalledWith('192.168.1.100', 9100, 5000);
      expect(conn.state).toBe('connected');
      expect(conn.isConnected).toBe(true);
    });

    it('emits stateChange events: connecting -> connected', async () => {
      const conn = createConnection();
      const states: string[] = [];
      conn.onStateChange((s) => states.push(s));
      await conn.connect();
      expect(states).toEqual(['connecting', 'connected']);
    });

    it('throws CONNECTION_TIMEOUT on native error', async () => {
      mockNative.connect.mockRejectedValueOnce(new Error('timeout'));
      const conn = createConnection();
      await expect(conn.connect()).rejects.toMatchObject({
        code: 'CONNECTION_TIMEOUT',
      });
      expect(conn.state).toBe('disconnected');
    });
  });

  describe('disconnect', () => {
    it('transitions to disconnected', async () => {
      const conn = createConnection();
      await conn.connect();
      await conn.disconnect();
      expect(conn.state).toBe('disconnected');
      expect(conn.isConnected).toBe(false);
    });

    it('stops auto-reconnect', async () => {
      const conn = createConnection();
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken pipe'));
      try { await conn.send(new Uint8Array([1])); } catch {}
      await conn.disconnect();
      expect(conn.state).toBe('disconnected');
      jest.advanceTimersByTime(10000);
      expect(conn.state).toBe('disconnected');
    });
  });

  describe('send', () => {
    it('throws NOT_CONNECTED if not connected', async () => {
      const conn = createConnection();
      await expect(conn.send(new Uint8Array([1]))).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    });

    it('sends base64 encoded data', async () => {
      const conn = createConnection();
      await conn.connect();
      await conn.send(new Uint8Array([0x48, 0x69, 0x21]));
      expect(mockNative.sendRawData).toHaveBeenCalledWith('SGkh');
    });

    it('throws SEND_FAILED and starts reconnect on native error', async () => {
      const conn = createConnection();
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken pipe'));
      await expect(conn.send(new Uint8Array([1]))).rejects.toMatchObject({ code: 'SEND_FAILED' });
      expect(conn.state).toBe('reconnecting');
    });
  });

  describe('auto-reconnect', () => {
    it('retries connection after retryInterval', async () => {
      const conn = createConnection({ retryInterval: 3000 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await conn.send(new Uint8Array([1])); } catch {}
      expect(conn.state).toBe('reconnecting');

      mockNative.connect.mockClear();
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); // flush microtasks
      expect(mockNative.connect).toHaveBeenCalledTimes(1);
    });

    it('transitions to connected on successful retry', async () => {
      const conn = createConnection({ retryInterval: 1000 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await conn.send(new Uint8Array([1])); } catch {}

      mockNative.connect.mockClear();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      // Wait for the reconnect promise to resolve
      await Promise.resolve();
      expect(conn.state).toBe('connected');
    });

    it('stops after maxRetries and transitions to disconnected', async () => {
      const conn = createConnection({ retryInterval: 1000, maxRetries: 2 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await conn.send(new Uint8Array([1])); } catch {}

      mockNative.connect.mockRejectedValue(new Error('still broken'));

      // Retry 1
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Retry 2
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(conn.state).toBe('disconnected');
    });

    it('does not reconnect when autoReconnect is false', async () => {
      const conn = createConnection({ autoReconnect: false });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await conn.send(new Uint8Array([1])); } catch {}
      expect(conn.state).toBe('disconnected');
    });

    it('emits CONNECTION_LOST error on send failure', async () => {
      const conn = createConnection();
      await conn.connect();
      const errors: PrinterError[] = [];
      conn.onError((e) => errors.push(e));
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await conn.send(new Uint8Array([1])); } catch {}
      expect(errors.length).toBe(1);
      expect(errors[0]!.code).toBe('CONNECTION_LOST');
    });
  });

  describe('event cleanup', () => {
    it('unsubscribes with returned function', async () => {
      const conn = createConnection();
      const states: string[] = [];
      const unsub = conn.onStateChange((s) => states.push(s));
      await conn.connect();
      unsub();
      await conn.disconnect();
      expect(states).toEqual(['connecting', 'connected']);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/connection.test.ts`
Expected: FAIL — Connection class doesn't exist yet

- [ ] **Step 3: Write connection.ts**

```typescript
// src/connection.ts

import NativeThermalPrinter from './NativeThermalPrinter';
import { PrinterError, type PrinterState } from './types';
import { uint8ArrayToBase64, base64ToUint8Array } from './encoding';

export interface ConnectionConfig {
  host: string;
  port: number;
  timeout: number;
  autoReconnect: boolean;
  retryInterval: number;
  maxRetries: number;
}

type StateListener = (state: PrinterState) => void;
type ErrorListener = (error: PrinterError) => void;

export class Connection {
  private config: ConnectionConfig;
  private _state: PrinterState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private stateListeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private hasConnectedOnce = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  get state(): PrinterState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this._state === 'connected') return;
    this.setState('connecting');
    try {
      await NativeThermalPrinter.connect(this.config.host, this.config.port, this.config.timeout);
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.setState('connected');
    } catch (e: any) {
      this.setState('disconnected');
      throw new PrinterError('CONNECTION_TIMEOUT', `Failed to connect to ${this.config.host}:${this.config.port}: ${e.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.stopReconnect();
    this.hasConnectedOnce = false;
    try {
      await NativeThermalPrinter.disconnect();
    } finally {
      this.setState('disconnected');
    }
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.isConnected) {
      throw new PrinterError('NOT_CONNECTED', 'Printer is not connected');
    }
    try {
      const base64 = uint8ArrayToBase64(data);
      await NativeThermalPrinter.sendRawData(base64);
    } catch (e: any) {
      this.handleSendError();
      throw new PrinterError('SEND_FAILED', `Failed to send data: ${e.message}`);
    }
  }

  async getImageRasterData(base64Image: string, width: number): Promise<Uint8Array> {
    try {
      const result = await NativeThermalPrinter.getImageRasterData(base64Image, width);
      return base64ToUint8Array(result);
    } catch (e: any) {
      throw new PrinterError('IMAGE_PROCESSING_FAILED', `Failed to process image: ${e.message}`);
    }
  }

  async renderTextToImage(text: string, fontSize: number, bold: boolean, maxWidth: number): Promise<Uint8Array> {
    try {
      const result = await NativeThermalPrinter.renderTextToImage(text, fontSize, bold, maxWidth);
      return base64ToUint8Array(result);
    } catch (e: any) {
      throw new PrinterError('IMAGE_PROCESSING_FAILED', `Failed to render text: ${e.message}`);
    }
  }

  private setState(state: PrinterState): void {
    if (this._state === state) return;
    this._state = state;
    this.stateListeners.forEach((l) => l(state));
  }

  private emitError(error: PrinterError): void {
    this.errorListeners.forEach((l) => l(error));
  }

  private handleSendError(): void {
    if (this.hasConnectedOnce && this.config.autoReconnect) {
      this.startReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private startReconnect(): void {
    if (this._state === 'reconnecting') return;
    this.setState('reconnecting');
    this.reconnectAttempts = 0;
    this.emitError(new PrinterError('CONNECTION_LOST', 'Connection lost, attempting to reconnect'));
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      this.setState('disconnected');
      return;
    }
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await NativeThermalPrinter.connect(this.config.host, this.config.port, this.config.timeout);
        this.setState('connected');
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, this.config.retryInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/connection.test.ts`
Expected: All tests PASS. Some tests related to timing may need adjustment — fix any timing issues by flushing microtasks properly.

- [ ] **Step 5: Commit**

```bash
git add src/connection.ts __tests__/connection.test.ts
git commit -m "feat: add Connection class with auto-reconnect and event system (TDD)"
```

---

### Task 6: ThermalPrinter class (TDD)

**Files:**
- Create: `src/ThermalPrinter.ts`
- Create: `__tests__/ThermalPrinter.test.ts`
- Delete: `src/ReceiptBuilder.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/ThermalPrinter.test.ts

import mockNative, { resetMocks } from './mocks/NativeThermalPrinter';

jest.mock('../src/NativeThermalPrinter', () => ({
  __esModule: true,
  default: require('./mocks/NativeThermalPrinter').default,
}));

import { ThermalPrinter } from '../src/ThermalPrinter';
import { PrinterError } from '../src/types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

beforeEach(() => {
  resetMocks();
});

describe('ThermalPrinter', () => {
  function createPrinter(overrides = {}) {
    return new ThermalPrinter({
      host: '192.168.1.100',
      ...overrides,
    });
  }

  describe('constructor defaults', () => {
    it('applies default config values', () => {
      const printer = createPrinter();
      expect(printer.isConnected).toBe(false);
    });
  });

  describe('connect/disconnect', () => {
    it('connects and disconnects', async () => {
      const printer = createPrinter();
      await printer.connect();
      expect(printer.isConnected).toBe(true);
      await printer.disconnect();
      expect(printer.isConnected).toBe(false);
    });
  });

  describe('events', () => {
    it('emits stateChange on connect', async () => {
      const printer = createPrinter();
      const states: string[] = [];
      printer.on('stateChange', (s) => states.push(s));
      await printer.connect();
      expect(states).toContain('connected');
    });

    it('emits error events', async () => {
      const printer = createPrinter();
      await printer.connect();
      const errors: PrinterError[] = [];
      printer.on('error', (e) => errors.push(e));
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try { await printer.printText('test'); } catch {}
      expect(errors.length).toBe(1);
    });
  });

  describe('printText', () => {
    it('throws NOT_CONNECTED when not connected', async () => {
      const printer = createPrinter();
      await expect(printer.printText('hi')).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    });

    it('sends text with default options', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Hi');
      expect(mockNative.sendRawData).toHaveBeenCalled();
      // Verify the base64 data decodes to valid ESC/POS
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('sends bold formatting when bold=true', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Bold', { bold: true });
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      // Decode and check it contains ESC E 1 (bold on) and ESC E 0 (bold off)
      const bytes = Buffer.from(base64, 'base64');
      const arr = Array.from(bytes);
      // Should contain bold on sequence
      expect(arr).toContain(0x45); // 'E' in ESC E command
    });

    it('uses image mode for Vietnamese text with non-CP1252 chars', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Cảm ơn');
      // ả (U+1EA3) and ơ (U+01A1) are outside CP1252
      expect(mockNative.renderTextToImage).toHaveBeenCalled();
    });

    it('uses ESC/POS mode for ASCII text', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Hello');
      expect(mockNative.renderTextToImage).not.toHaveBeenCalled();
    });

    it('uses ESC/POS mode for CP1252-compatible Vietnamese', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Xin chào');
      // à (U+00E0) is within CP1252
      expect(mockNative.renderTextToImage).not.toHaveBeenCalled();
    });

    it('forces image mode when forceImageMode=true', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Hello', { forceImageMode: true });
      expect(mockNative.renderTextToImage).toHaveBeenCalled();
    });
  });

  describe('printQR', () => {
    it('sends QR code commands with defaults', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printQR('https://example.com');
      expect(mockNative.sendRawData).toHaveBeenCalled();
    });
  });

  describe('printBarcode', () => {
    it('sends barcode commands with defaults', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printBarcode('123456');
      expect(mockNative.sendRawData).toHaveBeenCalled();
    });
  });

  describe('printImage', () => {
    it('calls native getImageRasterData and sends result', async () => {
      const printer = createPrinter();
      await printer.connect();
      // Mock returns small raster data: 6 bytes = 48 pixels wide (6*8) x 1 row
      mockNative.getImageRasterData.mockResolvedValueOnce('AQIDBAUG');
      await printer.printImage('base64imagedata', { width: 48 });
      expect(mockNative.getImageRasterData).toHaveBeenCalledWith('base64imagedata', 48);
      expect(mockNative.sendRawData).toHaveBeenCalled();
    });
  });

  describe('cut', () => {
    it('sends partial cut by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.cut();
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      const bytes = Buffer.from(base64, 'base64');
      // GS V 1 (partial)
      expect(Array.from(bytes)).toEqual([GS, 0x56, 1]);
    });

    it('sends full cut', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.cut('full');
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([GS, 0x56, 0]);
    });
  });

  describe('feed', () => {
    it('feeds 3 lines by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.feed();
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x64, 3]);
    });

    it('feeds specified number of lines', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.feed(5);
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x64, 5]);
    });
  });

  describe('openCashDrawer', () => {
    it('opens pin 0 by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.openCashDrawer();
      const base64 = mockNative.sendRawData.mock.calls[0]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x70, 0, 0x19, 0xff]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/ThermalPrinter.test.ts`
Expected: FAIL — ThermalPrinter class doesn't exist yet

- [ ] **Step 3: Write ThermalPrinter.ts**

```typescript
// src/ThermalPrinter.ts

import { Connection, type ConnectionConfig } from './connection';
import { commands, concatBytes } from './commands';
import { isCP1252Compatible } from './encoding';
import {
  PrinterError,
  type PrinterConfig,
  type PrinterState,
  type TextOptions,
  type QROptions,
  type BarcodeOptions,
  type ImageOptions,
  type CutType,
} from './types';

const DEFAULT_PORT = 9100;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_RETRY_INTERVAL = 3000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_PAPER_WIDTH = 384;
const BASE_FONT_SIZE = 24;

type EventMap = {
  stateChange: PrinterState;
  error: PrinterError;
};

export class ThermalPrinter {
  private connection: Connection;

  constructor(config: PrinterConfig) {
    const connConfig: ConnectionConfig = {
      host: config.host,
      port: config.port ?? DEFAULT_PORT,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      autoReconnect: config.autoReconnect ?? true,
      retryInterval: config.retryInterval ?? DEFAULT_RETRY_INTERVAL,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    };
    this.connection = new Connection(connConfig);
  }

  get isConnected(): boolean {
    return this.connection.isConnected;
  }

  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): () => void {
    if (event === 'stateChange') {
      return this.connection.onStateChange(listener as (s: PrinterState) => void);
    }
    if (event === 'error') {
      return this.connection.onError(listener as (e: PrinterError) => void);
    }
    return () => {};
  }

  async connect(): Promise<void> {
    await this.connection.connect();
    await this.connection.send(commands.initialize());
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  async printText(text: string, options?: TextOptions): Promise<void> {
    const useImageMode = options?.forceImageMode || !isCP1252Compatible(text);

    if (useImageMode) {
      await this.printTextAsImage(text, options);
    } else {
      await this.printTextAsEscPos(text, options);
    }
  }

  async printQR(data: string, options?: QROptions): Promise<void> {
    const align = options?.align ?? 'left';
    const size = options?.size ?? 6;
    const ec = options?.errorCorrection ?? 'M';

    const bytes = concatBytes(
      commands.setAlignment(align),
      commands.qrCode(data, size, ec),
      commands.setAlignment('left'),
    );
    await this.connection.send(bytes);
  }

  async printBarcode(data: string, options?: BarcodeOptions): Promise<void> {
    const align = options?.align ?? 'left';
    const type = options?.type ?? 'code128';
    const height = options?.height ?? 100;
    const width = options?.width ?? 3;
    const showText = options?.showText ?? 'below';

    const bytes = concatBytes(
      commands.setAlignment(align),
      commands.barcode(data, type, height, width, showText),
      commands.setAlignment('left'),
    );
    await this.connection.send(bytes);
  }

  async printImage(base64Image: string, options?: ImageOptions): Promise<void> {
    const width = options?.width ?? DEFAULT_PAPER_WIDTH;
    const align = options?.align ?? 'left';

    const rasterBytes = await this.connection.getImageRasterData(base64Image, width);
    const widthBytes = Math.ceil(width / 8);
    const heightDots = Math.floor(rasterBytes.length / widthBytes);

    const bytes = concatBytes(
      commands.setAlignment(align),
      commands.imageRasterHeader(widthBytes, heightDots),
      rasterBytes,
      commands.setAlignment('left'),
    );
    await this.connection.send(bytes);
  }

  async cut(mode?: CutType): Promise<void> {
    await this.connection.send(commands.cut(mode ?? 'partial'));
  }

  async feed(lines?: number): Promise<void> {
    await this.connection.send(commands.feedLines(lines ?? 3));
  }

  async openCashDrawer(pin?: 0 | 1): Promise<void> {
    await this.connection.send(commands.openCashDrawer(pin ?? 0));
  }

  private async printTextAsEscPos(text: string, options?: TextOptions): Promise<void> {
    const parts: Uint8Array[] = [];

    parts.push(commands.setAlignment(options?.align ?? 'left'));

    if (options?.bold) parts.push(commands.setBold(true));
    if (options?.underline && options.underline !== 'none') {
      parts.push(commands.setUnderline(options.underline));
    }
    if (options?.width || options?.height) {
      parts.push(commands.setFontSize(options?.width ?? 1, options?.height ?? 1));
    }

    parts.push(commands.text(text));

    // Reset formatting
    if (options?.bold) parts.push(commands.setBold(false));
    if (options?.underline && options.underline !== 'none') {
      parts.push(commands.setUnderline('none'));
    }
    if (options?.width || options?.height) {
      parts.push(commands.setFontSize(1, 1));
    }
    parts.push(commands.setAlignment('left'));

    await this.connection.send(concatBytes(...parts));
  }

  private async printTextAsImage(text: string, options?: TextOptions): Promise<void> {
    const scale = Math.max(options?.width ?? 1, options?.height ?? 1);
    const fontSize = BASE_FONT_SIZE * scale;
    const bold = options?.bold ?? false;

    const rasterBytes = await this.connection.renderTextToImage(text, fontSize, bold, DEFAULT_PAPER_WIDTH);
    const widthBytes = Math.ceil(DEFAULT_PAPER_WIDTH / 8);
    const heightDots = Math.floor(rasterBytes.length / widthBytes);

    const parts: Uint8Array[] = [];
    parts.push(commands.setAlignment(options?.align ?? 'left'));
    parts.push(commands.imageRasterHeader(widthBytes, heightDots));
    parts.push(rasterBytes);
    parts.push(commands.setAlignment('left'));

    await this.connection.send(concatBytes(...parts));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test __tests__/ThermalPrinter.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Delete ReceiptBuilder.ts and commit**

```bash
rm src/ReceiptBuilder.ts
git add src/ThermalPrinter.ts __tests__/ThermalPrinter.test.ts
git add src/ReceiptBuilder.ts
git commit -m "feat: add ThermalPrinter class as single public API (TDD)"
```

---

### Task 7: Update NativeThermalPrinter spec

**Files:**
- Modify: `src/NativeThermalPrinter.ts`

- [ ] **Step 1: Add renderTextToImage to spec**

Replace the entire file content:

```typescript
// src/NativeThermalPrinter.ts

import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  connect(host: string, port: number, timeout: number): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  sendRawData(base64Data: string): Promise<void>;
  getImageRasterData(base64Image: string, width: number): Promise<string>;
  renderTextToImage(text: string, fontSize: number, bold: boolean, maxWidth: number): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ThermalPrinter');
```

- [ ] **Step 2: Commit**

```bash
git add src/NativeThermalPrinter.ts
git commit -m "feat: add renderTextToImage to native module spec"
```

---

### Task 8: Native Android — renderTextToImage

**Files:**
- Modify: `android/src/main/java/com/thermalprinter/ThermalPrinterModule.kt`

- [ ] **Step 1: Add renderTextToImage method**

Add the following method to `ThermalPrinterModule` class, after the `getImageRasterData` method and before the `private fun disconnect()` method. Also add the required imports at the top of the file.

Add imports at top (after existing imports):

```kotlin
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.StaticLayout
import android.text.TextPaint
```

Add method:

```kotlin
  override fun renderTextToImage(text: String, fontSize: Double, bold: Boolean, maxWidth: Double, promise: Promise) {
    Thread {
      try {
        val targetWidth = maxWidth.toInt()
        val paint = TextPaint().apply {
          color = Color.BLACK
          textSize = fontSize.toFloat()
          typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
          isAntiAlias = true
        }

        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, targetWidth).build()
        val textHeight = layout.height

        val bitmap = Bitmap.createBitmap(targetWidth, textHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        layout.draw(canvas)

        val widthBytes = (targetWidth + 7) / 8
        val raster = ByteArray(widthBytes * textHeight)
        for (y in 0 until textHeight) {
          for (x in 0 until targetWidth) {
            val pixel = bitmap.getPixel(x, y)
            val gray = (Color.red(pixel) * 0.299 + Color.green(pixel) * 0.587 + Color.blue(pixel) * 0.114)
            if (gray < 128) {
              val byteIndex = y * widthBytes + x / 8
              raster[byteIndex] = (raster[byteIndex].toInt() or (0x80 shr (x % 8))).toByte()
            }
          }
        }
        bitmap.recycle()

        val result = Base64.encodeToString(raster, Base64.NO_WRAP)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("TEXT_RENDER_ERROR", "Failed to render text to image: ${e.message}", e)
      }
    }.start()
  }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && cd example && yarn android --no-packager 2>&1 | tail -20` (or just check for Kotlin compilation)
Expected: Build succeeds (or at least the Kotlin compilation step passes)

- [ ] **Step 3: Commit**

```bash
git add android/src/main/java/com/thermalprinter/ThermalPrinterModule.kt
git commit -m "feat(android): add renderTextToImage for Vietnamese text support"
```

---

### Task 9: Native iOS — renderTextToImage

**Files:**
- Modify: `ios/ThermalPrinter.mm`

- [ ] **Step 1: Add renderTextToImage method**

Add the following method to `ThermalPrinter.mm`, after the `getImageRasterData` method and before the `closeSocket` method. Also add the CoreText import at the top.

Add import at top (after existing imports):

```objc
#import <CoreText/CoreText.h>
```

Add method:

```objc
- (void)renderTextToImage:(NSString *)text
                 fontSize:(double)fontSize
                     bold:(BOOL)bold
                 maxWidth:(double)maxWidth
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    int targetWidth = (int)maxWidth;

    // Create font
    UIFont *font;
    if (bold) {
      font = [UIFont boldSystemFontOfSize:fontSize];
    } else {
      font = [UIFont systemFontOfSize:fontSize];
    }

    // Calculate text size with wrapping
    NSDictionary *attrs = @{NSFontAttributeName: font};
    CGRect textRect = [text boundingRectWithSize:CGSizeMake(targetWidth, CGFLOAT_MAX)
                                         options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingUsesFontLeading
                                      attributes:attrs
                                         context:nil];
    int textHeight = (int)ceil(textRect.size.height);
    if (textHeight <= 0) {
      textHeight = 1;
    }

    // Create bitmap context (grayscale)
    CGColorSpaceRef graySpace = CGColorSpaceCreateDeviceGray();
    CGContextRef ctx = CGBitmapContextCreate(NULL, targetWidth, textHeight, 8,
                                             targetWidth, graySpace,
                                             kCGImageAlphaNone);
    CGColorSpaceRelease(graySpace);

    if (!ctx) {
      reject(@"TEXT_RENDER_ERROR", @"Failed to create bitmap context", nil);
      return;
    }

    // Fill white background
    CGContextSetGrayFillColor(ctx, 1.0, 1.0);
    CGContextFillRect(ctx, CGRectMake(0, 0, targetWidth, textHeight));

    // Flip coordinates for text drawing
    CGContextTranslateCTM(ctx, 0, textHeight);
    CGContextScaleCTM(ctx, 1.0, -1.0);

    // Draw text using UIKit (push context)
    UIGraphicsPushContext(ctx);
    CGContextSetGrayFillColor(ctx, 0.0, 1.0); // Black text
    [text drawInRect:CGRectMake(0, 0, targetWidth, textHeight)
      withAttributes:attrs];
    UIGraphicsPopContext();

    // Read pixels and convert to raster
    uint8_t *pixels = (uint8_t *)CGBitmapContextGetData(ctx);
    int widthBytes = (targetWidth + 7) / 8;
    NSMutableData *raster = [NSMutableData dataWithLength:widthBytes * textHeight];
    uint8_t *rasterBytes = (uint8_t *)[raster mutableBytes];

    for (int y = 0; y < textHeight; y++) {
      for (int x = 0; x < targetWidth; x++) {
        uint8_t gray = pixels[y * targetWidth + x];
        if (gray < 128) {
          rasterBytes[y * widthBytes + x / 8] |= (0x80 >> (x % 8));
        }
      }
    }

    CGContextRelease(ctx);

    NSString *result = [raster base64EncodedStringWithOptions:0];
    resolve(result);
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/hoang/Code/react-native-thermal-printer/example/ios && pod install && xcodebuild -workspace ThermalPrinterExample.xcworkspace -scheme ThermalPrinterExample -sdk iphonesimulator -configuration Debug build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add ios/ThermalPrinter.mm
git commit -m "feat(ios): add renderTextToImage for Vietnamese text support"
```

---

### Task 10: Rewrite index.tsx and cleanup

**Files:**
- Rewrite: `src/index.tsx`

- [ ] **Step 1: Rewrite index.tsx**

```typescript
// src/index.tsx

export { ThermalPrinter } from './ThermalPrinter';
export { PrinterError } from './types';
export type {
  PrinterConfig,
  PrinterState,
  PrinterErrorCode,
  TextOptions,
  QROptions,
  BarcodeOptions,
  ImageOptions,
  CutType,
} from './types';
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test`
Expected: All tests PASS

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/index.tsx
git commit -m "refactor: rewrite index to export new public API"
```

---

### Task 11: Rewrite example app

**Files:**
- Rewrite: `example/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with new API**

```typescript
// example/src/App.tsx

import { useState, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ThermalPrinter, type PrinterState } from 'react-native-thermal-printer';

export default function App() {
  const printerRef = useRef<ThermalPrinter | null>(null);
  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState('9100');
  const [printerState, setPrinterState] = useState<PrinterState>('disconnected');
  const [status, setStatus] = useState('Disconnected');

  const connected = printerState === 'connected';

  const getPrinter = useCallback(() => {
    if (!printerRef.current) {
      const printer = new ThermalPrinter({
        host,
        port: parseInt(port, 10),
        timeout: 5000,
        autoReconnect: true,
        retryInterval: 3000,
        maxRetries: 5,
      });
      printer.on('stateChange', (state) => {
        setPrinterState(state);
        setStatus(state.charAt(0).toUpperCase() + state.slice(1));
      });
      printer.on('error', (err) => {
        setStatus(`Error: [${err.code}] ${err.message}`);
      });
      printerRef.current = printer;
    }
    return printerRef.current;
  }, [host, port]);

  const handleConnect = useCallback(async () => {
    try {
      setStatus('Connecting...');
      const printer = getPrinter();
      await printer.connect();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  const handleDisconnect = useCallback(async () => {
    try {
      await printerRef.current?.disconnect();
      printerRef.current = null;
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, []);

  const handlePrintReceipt = useCallback(async () => {
    try {
      const p = getPrinter();
      setStatus('Printing receipt...');
      await p.printText('MY STORE', { bold: true, align: 'center', width: 2, height: 2 });
      await p.printText('123 Main Street', { align: 'center' });
      await p.printText('Tel: (555) 123-4567', { align: 'center' });
      await p.printText('================================');
      await p.printText('Item 1                    $10.00');
      await p.printText('Item 2                    $20.00');
      await p.printText('Item 3                    $15.00');
      await p.printText('--------------------------------');
      await p.printText('Total: $45.00', { bold: true, align: 'right' });
      await p.feed(1);
      await p.printText('Thank you for your purchase!', { align: 'center' });
      await p.feed(3);
      await p.cut();
      setStatus('Receipt printed!');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  const handlePrintVietnamese = useCallback(async () => {
    try {
      const p = getPrinter();
      setStatus('Printing Vietnamese...');
      await p.printText('Xin chào quý khách!', { bold: true, align: 'center', width: 2, height: 2 });
      await p.printText('Cảm ơn bạn đã mua hàng', { align: 'center' });
      await p.printText('Hẹn gặp lại!', { align: 'center' });
      await p.feed(3);
      await p.cut();
      setStatus('Vietnamese text printed!');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  const handlePrintQR = useCallback(async () => {
    try {
      const p = getPrinter();
      setStatus('Printing QR code...');
      await p.printText('Scan QR Code:', { align: 'center' });
      await p.feed(1);
      await p.printQR('https://example.com/receipt/12345', { size: 8, align: 'center' });
      await p.feed(3);
      await p.cut();
      setStatus('QR code printed!');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  const handlePrintBarcode = useCallback(async () => {
    try {
      const p = getPrinter();
      setStatus('Printing barcode...');
      await p.printText('Barcode:', { align: 'center' });
      await p.feed(1);
      await p.printBarcode('1234567890', { type: 'code128', height: 80, width: 2, showText: 'below', align: 'center' });
      await p.feed(3);
      await p.cut();
      setStatus('Barcode printed!');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  const handleCut = useCallback(async () => {
    try {
      const p = getPrinter();
      await p.feed(3);
      await p.cut('full');
      setStatus('Paper cut!');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [getPrinter]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Thermal Printer</Text>
      <Text style={styles.status}>{status}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.inputHost]}
          value={host}
          onChangeText={setHost}
          placeholder="IP Address"
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.inputPort]}
          value={port}
          onChangeText={setPort}
          placeholder="Port"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.connectButton]}
          onPress={handleConnect}
          disabled={connected}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton]}
          onPress={handleDisconnect}
          disabled={!connected}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />

      <TouchableOpacity style={[styles.button, styles.printButton]} onPress={handlePrintReceipt} disabled={!connected}>
        <Text style={styles.buttonText}>Print Receipt</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.printButton]} onPress={handlePrintVietnamese} disabled={!connected}>
        <Text style={styles.buttonText}>Print Vietnamese</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.printButton]} onPress={handlePrintQR} disabled={!connected}>
        <Text style={styles.buttonText}>Print QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.printButton]} onPress={handlePrintBarcode} disabled={!connected}>
        <Text style={styles.buttonText}>Print Barcode</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.cutButton]} onPress={handleCut} disabled={!connected}>
        <Text style={styles.buttonText}>Cut Paper</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 20, paddingTop: 60, alignItems: 'stretch' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  status: { fontSize: 14, textAlign: 'center', marginBottom: 20, color: '#666' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  inputHost: { flex: 3 },
  inputPort: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  button: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  connectButton: { flex: 1, backgroundColor: '#34C759' },
  disconnectButton: { flex: 1, backgroundColor: '#FF3B30' },
  printButton: { backgroundColor: '#007AFF' },
  cutButton: { backgroundColor: '#FF9500' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#ccc', marginVertical: 16 },
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add example/src/App.tsx
git commit -m "refactor: rewrite example app to use new ThermalPrinter API"
```

---

### Task 12: Write README

**Files:**
- Rewrite: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# react-native-thermal-printer

ESC/POS thermal printer library for React Native. Supports text, images, barcodes, QR codes, and Vietnamese text via WiFi/Network connection.

**Target printers:** Epson, XPrinter (and other ESC/POS compatible printers)

## Installation

```bash
npm install react-native-thermal-printer
# or
yarn add react-native-thermal-printer
```

### iOS

```bash
cd ios && pod install
```

### Android

Add internet permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Quick Start

```typescript
import { ThermalPrinter } from 'react-native-thermal-printer';

const printer = new ThermalPrinter({ host: '192.168.1.100' });
await printer.connect();
await printer.printText('Hello World!', { bold: true, align: 'center' });
await printer.cut();
await printer.disconnect();
```

## API Reference

### `new ThermalPrinter(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | **required** | Printer IP address |
| `port` | `number` | `9100` | Printer port |
| `timeout` | `number` | `5000` | Connection timeout (ms) |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on connection loss |
| `retryInterval` | `number` | `3000` | Delay between reconnect attempts (ms) |
| `maxRetries` | `number` | `5` | Max reconnect attempts before giving up |

### Connection

```typescript
await printer.connect();
await printer.disconnect();
printer.isConnected; // boolean
```

### Events

```typescript
printer.on('stateChange', (state) => {
  // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
});

printer.on('error', (error) => {
  console.log(error.code, error.message);
});
```

### `printText(text, options?)`

```typescript
await printer.printText('Hello!', {
  bold: true,
  underline: 'single',      // 'none' | 'single' | 'double'
  align: 'center',          // 'left' | 'center' | 'right'
  width: 2,                 // 1-8, font width scale
  height: 2,                // 1-8, font height scale
  forceImageMode: false,    // Force text-as-image rendering
});
```

**Vietnamese text** is automatically detected and rendered as an image for correct display. Use `forceImageMode: true` to force image rendering for font consistency.

### `printQR(data, options?)`

```typescript
await printer.printQR('https://example.com', {
  size: 6,                  // Module size 1-16
  errorCorrection: 'M',     // 'L' | 'M' | 'Q' | 'H'
  align: 'center',
});
```

### `printBarcode(data, options?)`

```typescript
await printer.printBarcode('1234567890', {
  type: 'code128',          // 'code128' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'code39' | 'itf' | 'codabar' | 'code93'
  height: 100,              // Dots
  width: 3,                 // 2-6
  showText: 'below',        // 'none' | 'above' | 'below' | 'both'
  align: 'center',
});
```

### `printImage(base64, options?)`

```typescript
await printer.printImage(base64EncodedImage, {
  width: 384,               // Pixels (384 = 58mm paper)
  align: 'center',
});
```

### Paper Control

```typescript
await printer.cut('partial');  // 'full' | 'partial' (default: 'partial')
await printer.feed(3);         // Number of lines (default: 3)
```

### Cash Drawer

```typescript
await printer.openCashDrawer(0);  // Pin 0 or 1 (default: 0)
```

## Error Handling

All errors throw `PrinterError` with a `code` property:

```typescript
import { PrinterError } from 'react-native-thermal-printer';

try {
  await printer.connect();
} catch (error) {
  if (error instanceof PrinterError) {
    switch (error.code) {
      case 'CONNECTION_TIMEOUT':
        // Handle timeout
        break;
      case 'CONNECTION_REFUSED':
        // Handle refused
        break;
    }
  }
}
```

| Error Code | When |
|-----------|------|
| `CONNECTION_TIMEOUT` | Connection attempt timed out |
| `CONNECTION_REFUSED` | Printer refused connection |
| `CONNECTION_LOST` | Connection dropped (emitted as event during reconnect) |
| `NOT_CONNECTED` | Tried to print while not connected |
| `SEND_FAILED` | Failed to send data to printer |
| `IMAGE_PROCESSING_FAILED` | Failed to process image or render text |
| `INVALID_DATA` | Invalid input data |

## Auto-Reconnect

When enabled (default), the library automatically attempts to reconnect when the connection is lost:

1. Connection drops during a print operation
2. State changes to `'reconnecting'`, `CONNECTION_LOST` error is emitted
3. Retries every `retryInterval` ms, up to `maxRetries` times
4. On success: state returns to `'connected'`
5. On failure: state changes to `'disconnected'`

During reconnection, print methods will throw `NOT_CONNECTED`.

## Vietnamese Text

Vietnamese text (and other non-Latin characters) is automatically rendered as images for correct display on thermal printers. The library detects whether text contains characters outside the CP1252 code page and switches to image mode automatically.

- ASCII/CP1252 text: sent as ESC/POS commands (fast, sharp)
- Vietnamese/CJK/emoji: rendered to bitmap then printed as image

Use `forceImageMode: true` for consistent font appearance regardless of text content.

## Troubleshooting

**Cannot connect:**
- Verify printer IP and port (default: 9100)
- Ensure device is on the same network
- Check printer is powered on and network-ready

**Vietnamese text not printing correctly:**
- The library auto-detects and uses image mode
- Try `forceImageMode: true` if auto-detection fails

**Image quality is poor:**
- Ensure source image has sufficient resolution
- Use `width: 384` for 58mm paper, `width: 576` for 80mm paper
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: write comprehensive README with API reference"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run all tests**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn lint`
Expected: No errors (fix any lint issues if found)

- [ ] **Step 4: Verify build**

Run: `cd /Users/hoang/Code/react-native-thermal-printer && yarn prepare`
Expected: Build succeeds, generates lib/ output
