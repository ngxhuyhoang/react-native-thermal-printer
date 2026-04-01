package com.thermalprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.text.StaticLayout
import android.text.TextPaint
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket

class ThermalPrinterModule(reactContext: ReactApplicationContext) :
  NativeThermalPrinterSpec(reactContext) {

  private var socket: Socket? = null
  private var outputStream: OutputStream? = null

  override fun connect(host: String, port: Double, timeout: Double, promise: Promise) {
    Thread {
      try {
        disconnect()
        val sock = Socket()
        sock.connect(InetSocketAddress(host, port.toInt()), timeout.toInt())
        socket = sock
        outputStream = sock.getOutputStream()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("CONNECT_ERROR", "Failed to connect to $host:${port.toInt()}: ${e.message}", e)
      }
    }.start()
  }

  override fun disconnect(promise: Promise) {
    Thread {
      try {
        disconnect()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("DISCONNECT_ERROR", "Failed to disconnect: ${e.message}", e)
      }
    }.start()
  }

  override fun isConnected(promise: Promise) {
    val connected = socket?.let { !it.isClosed && it.isConnected } ?: false
    promise.resolve(connected)
  }

  override fun sendRawData(base64Data: String, promise: Promise) {
    Thread {
      try {
        val os = outputStream
        if (os == null || socket?.isClosed != false) {
          promise.reject("NOT_CONNECTED", "Printer is not connected")
          return@Thread
        }
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        os.write(bytes)
        os.flush()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("SEND_ERROR", "Failed to send data: ${e.message}", e)
      }
    }.start()
  }

  override fun getImageRasterData(base64Image: String, width: Double, promise: Promise) {
    Thread {
      try {
        val imageBytes = Base64.decode(base64Image, Base64.DEFAULT)
        val original = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Failed to decode image")

        val targetWidth = width.toInt()
        val ratio = targetWidth.toFloat() / original.width
        val targetHeight = (original.height * ratio).toInt()
        val scaled = Bitmap.createScaledBitmap(original, targetWidth, targetHeight, true)
        original.recycle()

        val widthBytes = (targetWidth + 7) / 8

        val raster = ByteArray(widthBytes * targetHeight)
        for (y in 0 until targetHeight) {
          for (x in 0 until targetWidth) {
            val pixel = scaled.getPixel(x, y)
            val gray = (Color.red(pixel) * 0.299 + Color.green(pixel) * 0.587 + Color.blue(pixel) * 0.114)
            if (gray < 128) {
              val byteIndex = y * widthBytes + x / 8
              raster[byteIndex] = (raster[byteIndex].toInt() or (0x80 shr (x % 8))).toByte()
            }
          }
        }
        scaled.recycle()

        val result = Base64.encodeToString(raster, Base64.NO_WRAP)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("IMAGE_DECODE_ERROR", "Failed to process image: ${e.message}", e)
      }
    }.start()
  }

  override fun renderTextToImage(text: String, fontSize: Double, bold: Boolean, maxWidth: Double, promise: Promise) {
    Thread {
      try {
        val targetWidth = maxWidth.toInt()
        val paint = TextPaint().apply {
          color = Color.BLACK
          textSize = fontSize.toFloat()
          typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
          isAntiAlias = true
        }

        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, targetWidth).build()
        val textHeight = layout.height

        val bitmap = Bitmap.createBitmap(targetWidth, textHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        layout.draw(canvas)

        val widthBytes = (targetWidth + 7) / 8
        val raster = ByteArray(widthBytes * textHeight)
        for (y in 0 until textHeight) {
          for (x in 0 until targetWidth) {
            val pixel = bitmap.getPixel(x, y)
            val gray = (Color.red(pixel) * 0.299 + Color.green(pixel) * 0.587 + Color.blue(pixel) * 0.114)
            if (gray < 128) {
              val byteIndex = y * widthBytes + x / 8
              raster[byteIndex] = (raster[byteIndex].toInt() or (0x80 shr (x % 8))).toByte()
            }
          }
        }
        bitmap.recycle()

        val result = Base64.encodeToString(raster, Base64.NO_WRAP)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("TEXT_RENDER_ERROR", "Failed to render text to image: ${e.message}", e)
      }
    }.start()
  }

  private fun disconnect() {
    try { outputStream?.close() } catch (_: Exception) {}
    try { socket?.close() } catch (_: Exception) {}
    outputStream = null
    socket = null
  }

  companion object {
    const val NAME = NativeThermalPrinterSpec.NAME
  }
}
