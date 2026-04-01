#import "ThermalPrinter.h"
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>
#import <UIKit/UIKit.h>
#import <CoreText/CoreText.h>

@implementation ThermalPrinter {
  int _socketFD;
  BOOL _isConnected;
  dispatch_queue_t _socketQueue;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _socketFD = -1;
    _isConnected = NO;
    _socketQueue = dispatch_queue_create("com.thermalprinter.socket", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (void)connect:(NSString *)host
            port:(double)port
         timeout:(double)timeout
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    [self closeSocket];

    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
      reject(@"CONNECT_ERROR", @"Failed to create socket", nil);
      return;
    }

    struct timeval tv;
    int timeoutMs = (int)timeout;
    tv.tv_sec = timeoutMs / 1000;
    tv.tv_usec = (timeoutMs % 1000) * 1000;
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons((uint16_t)port);

    if (inet_pton(AF_INET, [host UTF8String], &addr.sin_addr) <= 0) {
      close(sock);
      reject(@"CONNECT_ERROR", [NSString stringWithFormat:@"Invalid address: %@", host], nil);
      return;
    }

    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
      close(sock);
      reject(@"CONNECT_ERROR",
             [NSString stringWithFormat:@"Failed to connect to %@:%d", host, (int)port], nil);
      return;
    }

    self->_socketFD = sock;
    self->_isConnected = YES;
    resolve(nil);
  });
}

- (void)disconnect:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    [self closeSocket];
    resolve(nil);
  });
}

- (void)isConnected:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  resolve(@(self->_isConnected && self->_socketFD >= 0));
}

- (void)sendRawData:(NSString *)base64Data
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    if (!self->_isConnected || self->_socketFD < 0) {
      reject(@"NOT_CONNECTED", @"Printer is not connected", nil);
      return;
    }

    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
    if (!data) {
      reject(@"SEND_ERROR", @"Invalid base64 data", nil);
      return;
    }

    const uint8_t *bytes = (const uint8_t *)[data bytes];
    NSUInteger totalLength = [data length];
    NSUInteger sent = 0;

    while (sent < totalLength) {
      ssize_t result = send(self->_socketFD, bytes + sent, totalLength - sent, 0);
      if (result < 0) {
        [self closeSocket];
        reject(@"SEND_ERROR", @"Failed to send data", nil);
        return;
      }
      sent += result;
    }

    resolve(nil);
  });
}

- (void)getImageRasterData:(NSString *)base64Image
                     width:(double)width
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    NSData *imageData = [[NSData alloc] initWithBase64EncodedString:base64Image options:0];
    if (!imageData) {
      reject(@"IMAGE_DECODE_ERROR", @"Invalid base64 image data", nil);
      return;
    }

    UIImage *image = [UIImage imageWithData:imageData];
    if (!image) {
      reject(@"IMAGE_DECODE_ERROR", @"Failed to decode image", nil);
      return;
    }

    int targetWidth = (int)width;
    CGFloat ratio = (CGFloat)targetWidth / image.size.width;
    int targetHeight = (int)(image.size.height * ratio);

    // Render scaled grayscale image
    CGColorSpaceRef graySpace = CGColorSpaceCreateDeviceGray();
    CGContextRef ctx = CGBitmapContextCreate(NULL, targetWidth, targetHeight, 8,
                                             targetWidth, graySpace,
                                             kCGImageAlphaNone);
    CGColorSpaceRelease(graySpace);

    if (!ctx) {
      reject(@"IMAGE_DECODE_ERROR", @"Failed to create bitmap context", nil);
      return;
    }

    CGContextDrawImage(ctx, CGRectMake(0, 0, targetWidth, targetHeight), image.CGImage);
    uint8_t *pixels = (uint8_t *)CGBitmapContextGetData(ctx);

    int widthBytes = (targetWidth + 7) / 8;
    NSMutableData *raster = [NSMutableData dataWithLength:widthBytes * targetHeight];
    uint8_t *rasterBytes = (uint8_t *)[raster mutableBytes];

    for (int y = 0; y < targetHeight; y++) {
      for (int x = 0; x < targetWidth; x++) {
        uint8_t gray = pixels[y * targetWidth + x];
        // 1 = black dot, 0 = white (ESC/POS raster format)
        if (gray < 128) {
          rasterBytes[y * widthBytes + x / 8] |= (0x80 >> (x % 8));
        }
      }
    }

    CGContextRelease(ctx);

    NSString *result = [raster base64EncodedStringWithOptions:0];
    resolve(result);
  });
}

- (void)renderTextToImage:(NSString *)text
                 fontSize:(double)fontSize
                     bold:(BOOL)bold
                 maxWidth:(double)maxWidth
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(_socketQueue, ^{
    int targetWidth = (int)maxWidth;

    UIFont *font;
    if (bold) {
      font = [UIFont boldSystemFontOfSize:fontSize];
    } else {
      font = [UIFont systemFontOfSize:fontSize];
    }

    NSDictionary *attrs = @{NSFontAttributeName: font};
    CGRect textRect = [text boundingRectWithSize:CGSizeMake(targetWidth, CGFLOAT_MAX)
                                         options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingUsesFontLeading
                                      attributes:attrs
                                         context:nil];
    int textHeight = (int)ceil(textRect.size.height);
    if (textHeight <= 0) {
      textHeight = 1;
    }

    CGColorSpaceRef graySpace = CGColorSpaceCreateDeviceGray();
    CGContextRef ctx = CGBitmapContextCreate(NULL, targetWidth, textHeight, 8,
                                             targetWidth, graySpace,
                                             kCGImageAlphaNone);
    CGColorSpaceRelease(graySpace);

    if (!ctx) {
      reject(@"TEXT_RENDER_ERROR", @"Failed to create bitmap context", nil);
      return;
    }

    CGContextSetGrayFillColor(ctx, 1.0, 1.0);
    CGContextFillRect(ctx, CGRectMake(0, 0, targetWidth, textHeight));

    CGContextTranslateCTM(ctx, 0, textHeight);
    CGContextScaleCTM(ctx, 1.0, -1.0);

    UIGraphicsPushContext(ctx);
    CGContextSetGrayFillColor(ctx, 0.0, 1.0);
    [text drawInRect:CGRectMake(0, 0, targetWidth, textHeight)
      withAttributes:attrs];
    UIGraphicsPopContext();

    uint8_t *pixels = (uint8_t *)CGBitmapContextGetData(ctx);
    int widthBytes = (targetWidth + 7) / 8;
    NSMutableData *raster = [NSMutableData dataWithLength:widthBytes * textHeight];
    uint8_t *rasterBytes = (uint8_t *)[raster mutableBytes];

    for (int y = 0; y < textHeight; y++) {
      for (int x = 0; x < targetWidth; x++) {
        uint8_t gray = pixels[y * targetWidth + x];
        if (gray < 128) {
          rasterBytes[y * widthBytes + x / 8] |= (0x80 >> (x % 8));
        }
      }
    }

    CGContextRelease(ctx);

    NSString *result = [raster base64EncodedStringWithOptions:0];
    resolve(result);
  });
}

- (void)closeSocket {
  if (_socketFD >= 0) {
    close(_socketFD);
    _socketFD = -1;
  }
  _isConnected = NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeThermalPrinterSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"ThermalPrinter";
}

@end
