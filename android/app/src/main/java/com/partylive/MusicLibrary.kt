package com.partylive

import android.content.ContentUris
import android.provider.MediaStore
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// The songs on the phone (MediaStore), for the room's music playlist. JS asks for the audio permission first.
// The content:// uris go straight to ZEGO's media player, which reads them on Android.
class MusicLibraryModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName() = NAME

  @ReactMethod
  fun list(promise: Promise) {
    Thread {
      try {
        val out = Arguments.createArray()
        val cols = arrayOf(
          MediaStore.Audio.Media._ID,
          MediaStore.Audio.Media.TITLE,
          MediaStore.Audio.Media.ARTIST,
          MediaStore.Audio.Media.DURATION,
        )
        // Music only: skips ringtones, notification sounds and voice notes.
        ctx.contentResolver.query(
          MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, cols,
          "${MediaStore.Audio.Media.IS_MUSIC} != 0", null,
          "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC",
        )?.use { c ->
          while (c.moveToNext()) {
            val id = c.getLong(0)
            out.pushMap(Arguments.createMap().apply {
              putString("id", id.toString())
              putString("uri", ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id).toString())
              putString("title", c.getString(1) ?: "Unknown")
              val artist = c.getString(2)
              if (artist != null && artist != MediaStore.UNKNOWN_STRING) putString("artist", artist) else putNull("artist")
              putDouble("durationMs", c.getLong(3).toDouble())
            })
          }
        }
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("MUSIC_SCAN_FAILED", e.message, e)
      }
    }.start()
  }

  companion object {
    const val NAME = "MusicLibrary"
  }
}

class MusicLibraryPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == MusicLibraryModule.NAME) MusicLibraryModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(MusicLibraryModule.NAME to ReactModuleInfo(MusicLibraryModule.NAME, MusicLibraryModule::class.java.name, false, false, false, false))
  }
}
