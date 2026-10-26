package com.partylive

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// Keeps the app alive while it's in the background during a room, so the mic, the speakers and the room socket keep
// going (Android stops background mic capture and network otherwise). Started and stopped from ZegoAudioRoomService.
class RoomCallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val mic = intent?.getBooleanExtra(EXTRA_MIC, false) == true
    if (Build.VERSION.SDK_INT >= 26) {
      getSystemService(NotificationManager::class.java)
        .createNotificationChannel(NotificationChannel(CHANNEL, "Room in progress", NotificationManager.IMPORTANCE_LOW))
    }
    val open = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(getString(R.string.app_name))
      .setContentText(if (mic) "You're on the mic in a room" else "You're listening in a room")
      .setContentIntent(open)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .build()
    val types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK or (if (mic) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0)
    ServiceCompat.startForeground(this, 1, notification, types)
    return START_NOT_STICKY
  }

  // App swiped away from recents: the room is gone with it.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
  }

  companion object {
    const val CHANNEL = "room_call"
    const val EXTRA_MIC = "mic"
  }
}

class RoomCallModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName() = NAME

  // `mic`: on a seat. Called again to switch between listening and talking.
  @ReactMethod
  fun start(mic: Boolean) {
    // Android refuses a microphone service without the permission; listening still works without it.
    val canMic = mic && ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    try {
      ContextCompat.startForegroundService(ctx, Intent(ctx, RoomCallService::class.java).putExtra(RoomCallService.EXTRA_MIC, canMic))
    } catch (e: Exception) {
      // e.g. Android 12+ refuses to start one from the background; the room then just pauses in the background as before.
      Log.w(NAME, "could not start room service", e)
    }
  }

  @ReactMethod
  fun stop() {
    ctx.stopService(Intent(ctx, RoomCallService::class.java))
  }

  // A new direct message while the app is in the background. One notification per sender (newer replaces older);
  // tapping it opens the app. Silently skipped without the notification permission (Android 13+).
  // On/off app settings kept on the phone (Settings > Notifications); cleared on uninstall (allowBackup is off).
  private val settings get() = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)

  @ReactMethod
  fun getSetting(key: String, fallback: Boolean, promise: Promise) {
    promise.resolve(settings.getBoolean(key, fallback))
  }

  @ReactMethod
  fun setSetting(key: String, value: Boolean) {
    settings.edit().putBoolean(key, value).apply()
  }

  @ReactMethod
  fun notifyMessage(senderId: String, title: String, body: String) {
    if (!settings.getBoolean(SETTING_MESSAGES, true)) return // turned off in Settings > Notifications
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH))
    val open = PendingIntent.getActivity(ctx, 0, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val n = NotificationCompat.Builder(ctx, MESSAGES)
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(open)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .build()
    nm.notify("dm:$senderId", 0, n)
  }

  companion object {
    const val NAME = "RoomCall"
    const val MESSAGES = "messages"
    const val SETTING_MESSAGES = "notify_messages"
  }
}

class RoomCallPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == RoomCallModule.NAME) RoomCallModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(RoomCallModule.NAME to ReactModuleInfo(RoomCallModule.NAME, RoomCallModule::class.java.name, false, false, false, false))
  }
}
