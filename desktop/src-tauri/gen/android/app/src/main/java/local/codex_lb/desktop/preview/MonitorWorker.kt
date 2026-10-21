package local.codex_lb.desktop.preview

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import local.codex_lb.desktop.preview.background.collectBackground

class MonitorWorker(context: Context, parameters: WorkerParameters): CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val preferences = applicationContext.getSharedPreferences("monitor_widget", 0)
        val minutes = preferences.getInt("minutes", 10)
        val active = preferences.getInt("active_count", 0)
        val effective = try { MonitorWork.effectiveMinutes(minutes, active) } catch (_: Exception) { null }
        if (effective == null) { MonitorWork.reconcile(applicationContext, true); return@withContext Result.success() }
        preferences.edit().putLong("last_worker_at", System.currentTimeMillis()/1000).putString("last_worker_result", "running").apply()
        try {
            val reading = collectBackground(applicationContext.applicationInfo.dataDir, minutes.toUInt())
            // A user can disable while an in-flight request finishes; never enqueue replacement work here.
            MonitorSnapshot.save(applicationContext, reading.snapshot)
            preferences.edit().putLong("last_worker_at", System.currentTimeMillis()/1000).putString("last_worker_result", reading.outcome).apply()
            Result.success()
        } catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: LinkageError) {
            preferences.edit().putLong("last_worker_at", System.currentTimeMillis()/1000).putString("last_worker_result", "bridge_error").apply()
            Result.failure()
        }
        catch (_: Exception) {
            preferences.edit().putLong("last_worker_at", System.currentTimeMillis()/1000).putString("last_worker_result", "failed").apply()
            // Backoff is never shorter than the effective selected interval.
            Result.retry()
        }
    }
}
