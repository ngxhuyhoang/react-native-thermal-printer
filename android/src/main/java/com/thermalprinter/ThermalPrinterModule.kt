package com.thermalprinter

import com.facebook.react.bridge.ReactApplicationContext

class ThermalPrinterModule(reactContext: ReactApplicationContext) :
  NativeThermalPrinterSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeThermalPrinterSpec.NAME
  }
}
