// __tests__/mocks/NativeThermalPrinter.ts

const mockNativeModule = {
  connect: jest
    .fn<Promise<void>, [string, number, number]>()
    .mockResolvedValue(undefined),
  disconnect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  isConnected: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
  sendRawData: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  getImageRasterData: jest
    .fn<Promise<string>, [string, number]>()
    .mockResolvedValue('AA=='),
  renderTextToImage: jest
    .fn<Promise<string>, [string, number, boolean, number]>()
    .mockResolvedValue('AA=='),
};

export function resetMocks(): void {
  Object.values(mockNativeModule).forEach((fn) => fn.mockClear());
  mockNativeModule.connect.mockResolvedValue(undefined);
  mockNativeModule.disconnect.mockResolvedValue(undefined);
  mockNativeModule.isConnected.mockResolvedValue(true);
  mockNativeModule.sendRawData.mockResolvedValue(undefined);
  mockNativeModule.getImageRasterData.mockResolvedValue('AA==');
  mockNativeModule.renderTextToImage.mockResolvedValue('AA==');
}

export default mockNativeModule;
