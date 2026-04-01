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

  on<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void
  ): () => void {
    if (event === 'stateChange') {
      return this.connection.onStateChange(
        listener as (s: PrinterState) => void
      );
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
      commands.setAlignment('left')
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
      commands.setAlignment('left')
    );
    await this.connection.send(bytes);
  }

  async printImage(base64Image: string, options?: ImageOptions): Promise<void> {
    const width = options?.width ?? DEFAULT_PAPER_WIDTH;
    const align = options?.align ?? 'left';

    const rasterBytes = await this.connection.getImageRasterData(
      base64Image,
      width
    );
    const widthBytes = Math.ceil(width / 8);
    const heightDots = Math.floor(rasterBytes.length / widthBytes);

    const bytes = concatBytes(
      commands.setAlignment(align),
      commands.imageRasterHeader(widthBytes, heightDots),
      rasterBytes,
      commands.setAlignment('left')
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

  private async printTextAsEscPos(
    text: string,
    options?: TextOptions
  ): Promise<void> {
    const parts: Uint8Array[] = [];

    parts.push(commands.setAlignment(options?.align ?? 'left'));

    if (options?.bold) parts.push(commands.setBold(true));
    if (options?.underline && options.underline !== 'none') {
      parts.push(commands.setUnderline(options.underline));
    }
    if (options?.width || options?.height) {
      parts.push(
        commands.setFontSize(options?.width ?? 1, options?.height ?? 1)
      );
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

  private async printTextAsImage(
    text: string,
    options?: TextOptions
  ): Promise<void> {
    const scale = Math.max(options?.width ?? 1, options?.height ?? 1);
    const fontSize = BASE_FONT_SIZE * scale;
    const bold = options?.bold ?? false;

    const rasterBytes = await this.connection.renderTextToImage(
      text,
      fontSize,
      bold,
      DEFAULT_PAPER_WIDTH
    );
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
