# Thermal Printer Library Redesign — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Target printers:** Epson, XPrinter
**Connection:** WiFi/Network (TCP socket, port 9100)
**Protocol:** ESC/POS
**Platforms:** Android + iOS (React Native TurboModule)

---

## 1. Public API — `ThermalPrinter` Class

Single class that handles connection, printing, and events.

### Constructor

```typescript
const printer = new ThermalPrinter({
  host: '192.168.1.100',
  port: 9100,            // default: 9100
  timeout: 5000,         // default: 5000ms
  autoReconnect: true,   // default: true
  retryInterval: 3000,   // default: 3000ms
  maxRetries: 5,         // default: 5
});
```

### Events

```typescript
printer.on('stateChange', (state: PrinterState) => {});
printer.on('error', (error: PrinterError) => {});
```

### Connection

```typescript
await printer.connect();
await printer.disconnect();
printer.isConnected; // getter, boolean
```

### Text

```typescript
await printer.printText('Xin chao!', {
  bold?: boolean,
  underline?: 'none' | 'single' | 'double',
  align?: 'left' | 'center' | 'right',
  width?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  height?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  forceImageMode?: boolean,
});
```

### QR Code

```typescript
await printer.printQR('https://example.com', {
  size?: number,          // module size 1-16, default: 6
  errorCorrection?: 'L' | 'M' | 'Q' | 'H',  // default: 'M'
  align?: 'left' | 'center' | 'right',
});
```

### Barcode

```typescript
await printer.printBarcode('123456789', {
  type?: 'code128' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e'
         | 'code39' | 'itf' | 'codabar' | 'code93',  // default: 'code128'
  height?: number,        // dots, default: 100
  width?: number,         // 2-6, default: 3
  showText?: 'none' | 'above' | 'below' | 'both',  // default: 'below'
  align?: 'left' | 'center' | 'right',
});
```

### Image

```typescript
await printer.printImage(base64String, {
  width?: number,         // pixels, default: 384 (58mm paper)
  align?: 'left' | 'center' | 'right',
});
```

### Paper Control

```typescript
await printer.cut('full' | 'partial');  // default: 'partial'
await printer.feed(lines?: number);     // default: 3
```

### Cash Drawer

```typescript
await printer.openCashDrawer(pin?: 0 | 1);  // default: 0
```

### Design decisions

- All print methods are `async` — resolve after data is sent.
- All options are optional with sensible defaults.
- String literals instead of enums for better DX (`'center'` not `Alignment.Center`).
- `isConnected` is a sync getter, not an async method.

---

## 2. Error Handling & Events

### Error Codes

```typescript
type PrinterErrorCode =
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_LOST'
  | 'NOT_CONNECTED'
  | 'SEND_FAILED'
  | 'IMAGE_PROCESSING_FAILED'
  | 'INVALID_DATA';
```

### PrinterError

```typescript
class PrinterError extends Error {
  code: PrinterErrorCode;
  message: string;
}
```

### Printer States

```typescript
type PrinterState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
```

### Behavior

- **Throw** for fatal errors (developer must catch): `connect()` throws `CONNECTION_TIMEOUT` / `CONNECTION_REFUSED`. Print methods throw `NOT_CONNECTED`, `SEND_FAILED`, `IMAGE_PROCESSING_FAILED`, `INVALID_DATA`.
- **Event** for non-fatal errors (system handles): `CONNECTION_LOST` emits on `error` event while auto-reconnect runs. `stateChange` emits on every state transition.

---

## 3. Auto-Reconnect

### Flow

```
connect() -> connected
               | (connection lost)
            reconnecting <--+
               |            | fail (retries remaining)
            retry -----NO---+
               | YES
            connected

         max retries exceeded -> disconnected + emit error
```

### Rules

- Only activates after at least one successful `connect()`.
- `retryInterval: 3000ms` between attempts.
- `maxRetries: 5` — after 5 failures, stop and emit `stateChange('disconnected')`.
- Calling `disconnect()` disables auto-reconnect.
- During reconnecting, print methods throw `NOT_CONNECTED`.

---

## 4. Vietnamese Text Support

### Strategy: Two-step detection

```
printText("Xin chao")
     |
  Step 1: Is text within ASCII/CP1252?
     | YES                    | NO
  Send ESC/POS text        Step 2: Render text -> image
  (fast, sharp)            then print as image (slower, but correct)
```

- **Step 1:** Text containing only ASCII/CP1252 characters is sent as ESC/POS commands. Fast, best quality.
- **Step 2:** Text with characters outside CP1252 (Vietnamese diacritics, CJK, emoji) is rendered to bitmap on native side (Android: `Canvas.drawText()`, iOS: `CoreText`) and printed as image.
- Detection is automatic — developer does not need to know about this.
- `forceImageMode: true` option bypasses detection and always renders as image (for font consistency).

---

## 5. Internal Architecture

### File structure

```
src/
  index.tsx              # Single export: ThermalPrinter, PrinterError, types
  ThermalPrinter.ts      # Main class — public API
  commands.ts            # ESC/POS byte generation (internal, not exported)
  connection.ts          # Native bridge wrapper + reconnect logic (internal)
  encoding.ts            # Text detection ASCII/CP1252 + code page mapping (internal)
  types.ts               # All TypeScript types and option interfaces
  NativeThermalPrinter.ts # TurboModule spec (unchanged)

android/  # Native module: socket + image rasterization + text-to-image
ios/      # Native module: socket + image rasterization + text-to-image
```

### Principles

- Only export `ThermalPrinter`, `PrinterError`, and types from `index.tsx`.
- `commands.ts` replaces `escpos.ts` — same logic but internal only.
- `ReceiptBuilder.ts` is removed — replaced by methods on `ThermalPrinter` class.
- Native module adds `renderTextToImage(text, options)` method for Vietnamese support.

---

## 6. Testing

### Test structure

```
__tests__/
  commands.test.ts       # Unit: ESC/POS byte output matches expected format
  encoding.test.ts       # Unit: detect ASCII vs Vietnamese vs CJK
  ThermalPrinter.test.ts # Unit: option defaults, validation, state machine
  connection.test.ts     # Integration: mock native module, test reconnect logic
  mocks/
    NativeThermalPrinter.ts  # Mock native module for all tests
```

### Strategy

- **Unit tests** for `commands.ts`, `encoding.ts`: Pure functions, no mocks needed. Verify exact byte output.
- **Unit tests** for `ThermalPrinter.ts`: Mock native module. Test state transitions (disconnected -> connecting -> connected), options validation, error throwing.
- **Integration tests** for `connection.ts`: Mock native module. Test reconnect flow (retry count, interval, max retries -> disconnect).
- **No E2E tests** with real printer — use example app for manual testing.

---

## 7. Documentation

### README.md

- Installation (yarn/npm, pod install, Android setup)
- Quick Start (connect + print text in 5 lines)
- Full API Reference (every method with options and examples)
- Error Handling guide
- Vietnamese text support explanation
- Troubleshooting (common issues with Epson/XPrinter)

### Example App

- `example/src/App.tsx` covering all features: connect, print text, QR, barcode, image, Vietnamese text, cut, error display.
