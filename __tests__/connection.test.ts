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
      expect(mockNative.connect).toHaveBeenCalledWith(
        '192.168.1.100',
        9100,
        5000
      );
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
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}
      await conn.disconnect();
      expect(conn.state).toBe('disconnected');
      jest.advanceTimersByTime(10000);
      expect(conn.state).toBe('disconnected');
    });
  });

  describe('send', () => {
    it('throws NOT_CONNECTED if not connected', async () => {
      const conn = createConnection();
      await expect(conn.send(new Uint8Array([1]))).rejects.toMatchObject({
        code: 'NOT_CONNECTED',
      });
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
      await expect(conn.send(new Uint8Array([1]))).rejects.toMatchObject({
        code: 'SEND_FAILED',
      });
      expect(conn.state).toBe('reconnecting');
    });
  });

  describe('auto-reconnect', () => {
    it('retries connection after retryInterval', async () => {
      const conn = createConnection({ retryInterval: 3000 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}
      expect(conn.state).toBe('reconnecting');

      mockNative.connect.mockClear();
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(mockNative.connect).toHaveBeenCalledTimes(1);
    });

    it('transitions to connected on successful retry', async () => {
      const conn = createConnection({ retryInterval: 1000 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}

      mockNative.connect.mockClear();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
      expect(conn.state).toBe('connected');
    });

    it('stops after maxRetries and transitions to disconnected', async () => {
      const conn = createConnection({ retryInterval: 1000, maxRetries: 2 });
      await conn.connect();
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}

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
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}
      expect(conn.state).toBe('disconnected');
    });

    it('emits CONNECTION_LOST error on send failure', async () => {
      const conn = createConnection();
      await conn.connect();
      const errors: PrinterError[] = [];
      conn.onError((e) => errors.push(e));
      mockNative.sendRawData.mockRejectedValueOnce(new Error('broken'));
      try {
        await conn.send(new Uint8Array([1]));
      } catch {}
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
