// src/types.ts

export type PrinterState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

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
  type?:
    | 'code128'
    | 'ean13'
    | 'ean8'
    | 'upc_a'
    | 'upc_e'
    | 'code39'
    | 'itf'
    | 'codabar'
    | 'code93';
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
export type BarcodeType =
  | 'code128'
  | 'ean13'
  | 'ean8'
  | 'upc_a'
  | 'upc_e'
  | 'code39'
  | 'itf'
  | 'codabar'
  | 'code93';
export type HriPosition = 'none' | 'above' | 'below' | 'both';
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type CutType = 'full' | 'partial';
