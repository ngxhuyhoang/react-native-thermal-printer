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
      await NativeThermalPrinter.connect(
        this.config.host,
        this.config.port,
        this.config.timeout
      );
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.setState('connected');
    } catch (e: any) {
      this.setState('disconnected');
      throw new PrinterError(
        'CONNECTION_TIMEOUT',
        `Failed to connect to ${this.config.host}:${this.config.port}: ${e.message}`
      );
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
      throw new PrinterError(
        'SEND_FAILED',
        `Failed to send data: ${e.message}`
      );
    }
  }

  async getImageRasterData(
    base64Image: string,
    width: number
  ): Promise<Uint8Array> {
    try {
      const result = await NativeThermalPrinter.getImageRasterData(
        base64Image,
        width
      );
      return base64ToUint8Array(result);
    } catch (e: any) {
      throw new PrinterError(
        'IMAGE_PROCESSING_FAILED',
        `Failed to process image: ${e.message}`
      );
    }
  }

  async renderTextToImage(
    text: string,
    fontSize: number,
    bold: boolean,
    maxWidth: number
  ): Promise<Uint8Array> {
    try {
      const result = await NativeThermalPrinter.renderTextToImage(
        text,
        fontSize,
        bold,
        maxWidth
      );
      return base64ToUint8Array(result);
    } catch (e: any) {
      throw new PrinterError(
        'IMAGE_PROCESSING_FAILED',
        `Failed to render text: ${e.message}`
      );
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
    this.emitError(
      new PrinterError(
        'CONNECTION_LOST',
        'Connection lost, attempting to reconnect'
      )
    );
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
        await NativeThermalPrinter.connect(
          this.config.host,
          this.config.port,
          this.config.timeout
        );
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
