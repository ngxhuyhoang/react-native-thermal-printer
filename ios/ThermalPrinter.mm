#import "ThermalPrinter.h"
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>
#import <netdb.h>
#import <fcntl.h>
#import <poll.h>
#import <errno.h>
#import <string.h>
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

    int timeoutMs = (int)timeout;

    // Resolve the host. Unlike inet_pton, getaddrinfo supports hostnames,
    // mDNS (.local) names and IPv6 in addition to dotted-decimal IPv4.
    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    NSString *portString = [NSString stringWithFormat:@"%d", (int)port];
    struct addrinfo *results = NULL;
    int status = getaddrinfo([host UTF8String], [portString UTF8String], &hints, &results);
    if (status != 0 || results == NULL) {
      reject(@"CONNECT_ERROR",
             [NSString stringWithFormat:@"Failed to resolve %@: %s", host, gai_strerror(status)],
             nil);
      return;
    }

    int sock = -1;
    NSString *lastError = nil;

    for (struct addrinfo *ai = results; ai != NULL; ai = ai->ai_next) {
      int fd = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
      if (fd < 0) {
        lastError = [NSString stringWithFormat:@"socket(): %s", strerror(errno)];
        continue;
      }

      // Connect non-blocking so the timeout is actually enforced. A blocking
      // connect() would ignore SO_SNDTIMEO and hang on the kernel TCP timeout
      // (~75s) when the printer is powered off or unreachable.
      int flags = fcntl(fd, F_GETFL, 0);
      fcntl(fd, F_SETFL, flags | O_NONBLOCK);

      int rc = connect(fd, ai->ai_addr, ai->ai_addrlen);
      if (rc < 0 && errno != EINPROGRESS) {
        lastError = [NSString stringWithFormat:@"connect(): %s", strerror(errno)];
        close(fd);
        continue;
      }

      if (rc < 0) {
        // Wait up to timeoutMs for the connection to complete.
        struct pollfd pfd;
        pfd.fd = fd;
        pfd.events = POLLOUT;
        int pr = poll(&pfd, 1, timeoutMs);
        if (pr == 0) {
          lastError = @"connection timed out";
          close(fd);
          continue;
        }
        if (pr < 0) {
          lastError = [NSString stringWithFormat:@"poll(): %s", strerror(errno)];
          close(fd);
          continue;
        }

        // poll() reported the socket is writable; confirm there was no error.
        int soError = 0;
        socklen_t len = sizeof(soError);
        if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &soError, &len) < 0 || soError != 0) {
          lastError = [NSString stringWithFormat:@"connect(): %s",
                       strerror(soError != 0 ? soError : errno)];
          close(fd);
          continue;
        }
      }

      // Connected. Restore blocking mode for the subsequent send loop.
      fcntl(fd, F_SETFL, flags);
      sock = fd;
      break;
    }

    freeaddrinfo(results);

    if (sock < 0) {
      reject(@"CONNECT_ERROR",
             [NSString stringWithFormat:@"Failed to connect to %@:%d: %@",
              host, (int)port, lastError ?: @"unknown error"],
             nil);
      return;
    }

    // Apply send/receive timeouts for the subsequent blocking I/O.
    struct timeval tv;
    tv.tv_sec = timeoutMs / 1000;
    tv.tv_usec = (timeoutMs % 1000) * 1000;
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

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
