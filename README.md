# react-native-thermal-printer

[![npm version](https://img.shields.io/npm/v/@hoangnh0099/react-native-thermal-printer.svg)](https://www.npmjs.com/package/@hoangnh0099/react-native-thermal-printer)
[![npm downloads](https://img.shields.io/npm/dm/@hoangnh0099/react-native-thermal-printer.svg)](https://www.npmjs.com/package/@hoangnh0099/react-native-thermal-printer)
[![license](https://img.shields.io/npm/l/@hoangnh0099/react-native-thermal-printer.svg)](https://github.com/nicekid1/react-native-thermal-printer/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)](https://reactnative.dev)

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

## Support

If you find this library useful, consider buying me a coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/hoangnh0099)
