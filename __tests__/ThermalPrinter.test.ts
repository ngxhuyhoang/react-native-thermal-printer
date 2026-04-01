import mockNative, { resetMocks } from './mocks/NativeThermalPrinter';

jest.mock('../src/NativeThermalPrinter', () => ({
  __esModule: true,
  default: require('./mocks/NativeThermalPrinter').default,
}));

import { ThermalPrinter } from '../src/ThermalPrinter';
import { PrinterError } from '../src/types';

const ESC = 0x1b;
const GS = 0x1d;

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
      try {
        await printer.printText('test');
      } catch {}
      expect(errors.length).toBe(1);
    });
  });

  describe('printText', () => {
    it('throws NOT_CONNECTED when not connected', async () => {
      const printer = createPrinter();
      await expect(printer.printText('hi')).rejects.toMatchObject({
        code: 'NOT_CONNECTED',
      });
    });

    it('sends text with default options', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Hi');
      // sendRawData called at least twice: once for initialize (in connect), once for printText
      expect(mockNative.sendRawData.mock.calls.length).toBeGreaterThanOrEqual(
        2
      );
    });

    it('sends bold formatting when bold=true', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Bold', { bold: true });
      // Get the last sendRawData call (the printText one, not the initialize)
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      const arr = Array.from(bytes);
      // Should contain ESC E 1 (bold on)
      expect(arr).toContain(0x45);
    });

    it('uses image mode for Vietnamese text with non-CP1252 chars', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.printText('Cảm ơn');
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
      mockNative.getImageRasterData.mockResolvedValueOnce('AQIDBAUG');
      await printer.printImage('base64imagedata', { width: 48 });
      expect(mockNative.getImageRasterData).toHaveBeenCalledWith(
        'base64imagedata',
        48
      );
      expect(mockNative.sendRawData).toHaveBeenCalled();
    });
  });

  describe('cut', () => {
    it('sends partial cut by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.cut();
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([GS, 0x56, 1]);
    });

    it('sends full cut', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.cut('full');
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([GS, 0x56, 0]);
    });
  });

  describe('feed', () => {
    it('feeds 3 lines by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.feed();
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x64, 3]);
    });

    it('feeds specified number of lines', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.feed(5);
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x64, 5]);
    });
  });

  describe('openCashDrawer', () => {
    it('opens pin 0 by default', async () => {
      const printer = createPrinter();
      await printer.connect();
      await printer.openCashDrawer();
      const calls = mockNative.sendRawData.mock.calls;
      const base64 = calls[calls.length - 1]![0];
      const bytes = Buffer.from(base64, 'base64');
      expect(Array.from(bytes)).toEqual([ESC, 0x70, 0, 0x19, 0xff]);
    });
  });
});
