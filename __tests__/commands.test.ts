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
      expect(result).toEqual(new Uint8Array([0x48, 0x69, LF]));
    });
  });

  describe('setAlignment', () => {
    it('maps left to 0', () => {
      expect(commands.setAlignment('left')).toEqual(
        new Uint8Array([ESC, 0x61, 0])
      );
    });
    it('maps center to 1', () => {
      expect(commands.setAlignment('center')).toEqual(
        new Uint8Array([ESC, 0x61, 1])
      );
    });
    it('maps right to 2', () => {
      expect(commands.setAlignment('right')).toEqual(
        new Uint8Array([ESC, 0x61, 2])
      );
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
      expect(commands.setUnderline('none')).toEqual(
        new Uint8Array([ESC, 0x2d, 0])
      );
    });
    it('maps single to 1', () => {
      expect(commands.setUnderline('single')).toEqual(
        new Uint8Array([ESC, 0x2d, 1])
      );
    });
    it('maps double to 2', () => {
      expect(commands.setUnderline('double')).toEqual(
        new Uint8Array([ESC, 0x2d, 2])
      );
    });
  });

  describe('setFontSize', () => {
    it('encodes width=1 height=1 as 0x00', () => {
      expect(commands.setFontSize(1, 1)).toEqual(
        new Uint8Array([GS, 0x21, 0x00])
      );
    });
    it('encodes width=2 height=3 as 0x12', () => {
      expect(commands.setFontSize(2, 3)).toEqual(
        new Uint8Array([GS, 0x21, 0x12])
      );
    });
    it('clamps to 1-8 range', () => {
      expect(commands.setFontSize(8, 8)).toEqual(
        new Uint8Array([GS, 0x21, 0x77])
      );
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
      expect(result[0]).toBe(GS);
      expect(result[2]).toBe(100);
      expect(result[3]).toBe(GS);
      expect(result[5]).toBe(3);
      expect(result[6]).toBe(GS);
      expect(result[8]).toBe(2);
      expect(result[9]).toBe(GS);
      expect(result[11]).toBe(73);
      expect(result[12]).toBe(3);
    });
  });

  describe('qrCode', () => {
    it('generates QR code commands', () => {
      const result = commands.qrCode('AB', 6, 'M');
      expect(result[0]).toBe(GS);
      expect(result[1]).toBe(0x28);
      expect(result[2]).toBe(0x6b);
      expect(result[16]).toBe(6);
      expect(result[24]).toBe(49);
    });
  });

  describe('imageRasterHeader', () => {
    it('generates raster header', () => {
      const result = commands.imageRasterHeader(48, 100);
      expect(result).toEqual(
        new Uint8Array([GS, 0x76, 0x30, 0x00, 48, 0, 100, 0])
      );
    });
  });

  describe('openCashDrawer', () => {
    it('opens pin 0', () => {
      expect(commands.openCashDrawer(0)).toEqual(
        new Uint8Array([ESC, 0x70, 0, 0x19, 0xff])
      );
    });
    it('opens pin 1', () => {
      expect(commands.openCashDrawer(1)).toEqual(
        new Uint8Array([ESC, 0x70, 1, 0x19, 0xff])
      );
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
