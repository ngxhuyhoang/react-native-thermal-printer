import { useState, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  ThermalPrinter,
  type PrinterState,
} from 'react-native-thermal-printer';

export default function App() {
  const printerRef = useRef<ThermalPrinter | null>(null);
  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState('9100');
  const [printerState, setPrinterState] =
    useState<PrinterState>('disconnected');
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
      await p.printText('MY STORE', {
        bold: true,
        align: 'center',
        width: 2,
        height: 2,
      });
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
      await p.printText('Xin chào quý khách!', {
        bold: true,
        align: 'center',
        width: 2,
        height: 2,
      });
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
      await p.printQR('https://example.com/receipt/12345', {
        size: 8,
        align: 'center',
      });
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
      await p.printBarcode('1234567890', {
        type: 'code128',
        height: 80,
        width: 2,
        showText: 'below',
        align: 'center',
      });
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
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
    >
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

      <TouchableOpacity
        style={[styles.button, styles.printButton]}
        onPress={handlePrintReceipt}
        disabled={!connected}
      >
        <Text style={styles.buttonText}>Print Receipt</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.printButton]}
        onPress={handlePrintVietnamese}
        disabled={!connected}
      >
        <Text style={styles.buttonText}>Print Vietnamese</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.printButton]}
        onPress={handlePrintQR}
        disabled={!connected}
      >
        <Text style={styles.buttonText}>Print QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.printButton]}
        onPress={handlePrintBarcode}
        disabled={!connected}
      >
        <Text style={styles.buttonText}>Print Barcode</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.cutButton]}
        onPress={handleCut}
        disabled={!connected}
      >
        <Text style={styles.buttonText}>Cut Paper</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 20, paddingTop: 60, alignItems: 'stretch' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputHost: { flex: 3 },
  inputPort: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  connectButton: { flex: 1, backgroundColor: '#34C759' },
  disconnectButton: { flex: 1, backgroundColor: '#FF3B30' },
  printButton: { backgroundColor: '#007AFF' },
  cutButton: { backgroundColor: '#FF9500' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#ccc', marginVertical: 16 },
});
