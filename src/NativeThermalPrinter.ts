import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  connect(host: string, port: number, timeout: number): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  sendRawData(base64Data: string): Promise<void>;
  getImageRasterData(base64Image: string, width: number): Promise<string>;
  renderTextToImage(
    text: string,
    fontSize: number,
    bold: boolean,
    maxWidth: number
  ): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ThermalPrinter');
