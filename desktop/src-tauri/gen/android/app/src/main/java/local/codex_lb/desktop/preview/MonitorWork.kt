package local.codex_lb.desktop.preview

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object MonitorWork {
    const val NAME = "codex-monitor-usage"
    private val allowed = setOf(0, 1, 5, 10, 30, 60, 100)
    fun effectiveMinutes(selected: Int, active: Int): Long? {
        require(selected in allowed)
        return if (selected == 0 || active <= 0) null else maxOf(15, selected).toLong()
    }
    fun request(minutes: Long): PeriodicWorkRequest = PeriodicWorkRequest.Builder(MonitorWorker::class.java, minutes, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build())
        .setInitialDelay(minutes, TimeUnit.MINUTES)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, minutes, TimeUnit.MINUTES)
        .addTag(NAME).build()
    @Synchronized
    fun reconcile(context: Context, forceCancel: Boolean = false) {
        val preferences = context.getSharedPreferences("monitor_widget", 0)
        val selected = preferences.getInt("minutes", 10)
        val minutes = try { effectiveMinutes(selected, preferences.getInt("active_count", 0)) } catch (_: Exception) { null }
        val prior = preferences.getLong("scheduled_minutes", 0)
        val manager = WorkManager.getInstance(context)
        if (minutes == null) {
            if (prior != 0L || forceCancel) manager.cancelUniqueWork(NAME)
            preferences.edit().putLong("scheduled_minutes", 0).apply()
        } else if (prior != minutes) {
            manager.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, request(minutes))
            preferences.edit().putLong("scheduled_minutes", minutes).apply()
        }
    }
}
