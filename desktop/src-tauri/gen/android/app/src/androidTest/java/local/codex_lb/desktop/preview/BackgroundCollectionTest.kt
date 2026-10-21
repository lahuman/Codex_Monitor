package local.codex_lb.desktop.preview

import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.ListenableWorker
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.TestListenableWorkerBuilder
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class BackgroundCollectionTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val prefs get() = context.getSharedPreferences("monitor_widget", 0)
    @Before fun emulatorOnly() {
        assumeTrue("Dedicated empty emulator only", Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk"))
    }
    @Test fun aColdWorkerWithoutActivity() = runBlocking {
        // The test APK has not launched any Activity or WebView. Synthetic scheduling count,
        // empty real Rust store: no account credentials or provider request are required.
        prefs.edit().clear().putInt("minutes", 1).putInt("active_count", 1).commit()
        val result = TestListenableWorkerBuilder<MonitorWorker>(context).build().doWork()
        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals("completed", prefs.getString("last_worker_result", null))
        assertTrue(prefs.getLong("last_worker_at", 0) > 0)
        assertEquals(0, prefs.getInt("active_count", -1))
        assertTrue(prefs.getString("snapshot", "")!!.contains("accounts"))
    }
    @Test fun bConstraintsAndUniqueSchedule() {
        val request = MonitorWork.request(15)
        assertEquals(NetworkType.CONNECTED, request.workSpec.constraints.requiredNetworkType)
        assertTrue(request.workSpec.constraints.requiresBatteryNotLow())
        assertEquals(TimeUnit.MINUTES.toMillis(15), request.workSpec.intervalDuration)
        assertEquals(TimeUnit.MINUTES.toMillis(15), request.workSpec.initialDelay)
        val manager = WorkManager.getInstance(context)
        prefs.edit().putInt("minutes", 1).putInt("active_count", 1).commit()
        repeat(3) { MonitorWork.reconcile(context) }
        var active = manager.getWorkInfosForUniqueWork(MonitorWork.NAME).get(10, TimeUnit.SECONDS).filter { !it.state.isFinished }
        assertEquals(1, active.size)
        val id = active.single().id
        prefs.edit().putInt("minutes", 100).commit()
        MonitorWork.reconcile(context)
        active = manager.getWorkInfosForUniqueWork(MonitorWork.NAME).get(10, TimeUnit.SECONDS).filter { !it.state.isFinished }
        assertEquals(id, active.single().id)
        assertEquals(100L, prefs.getLong("scheduled_minutes", 0))
        prefs.edit().putInt("minutes", 0).commit()
        MonitorWork.reconcile(context, true)
        assertTrue(manager.getWorkInfosForUniqueWork(MonitorWork.NAME).get(10, TimeUnit.SECONDS).all { it.state == WorkInfo.State.CANCELLED || it.state.isFinished })
    }
    @Test fun cDisabledWorkerDoesNothing() = runBlocking {
        prefs.edit().putInt("minutes", 0).putLong("last_worker_at", 123).commit()
        assertEquals(ListenableWorker.Result.success(), TestListenableWorkerBuilder<MonitorWorker>(context).build().doWork())
        assertEquals(123L, prefs.getLong("last_worker_at", 0))
        assertNull(MonitorWork.effectiveMinutes(0, 1))
        assertNull(MonitorWork.effectiveMinutes(10, 0))
        listOf(1, 5, 10).forEach { assertEquals(15L, MonitorWork.effectiveMinutes(it, 1)) }
        listOf(30, 60, 100).forEach { assertEquals(it.toLong(), MonitorWork.effectiveMinutes(it, 1)) }
    }
    @Test fun dPrepareProcessRestart() {
        prefs.edit().putInt("minutes", 1).putInt("active_count", 1).putLong("last_worker_at", 123).commit()
        MonitorWork.reconcile(context)
        assertEquals(1, WorkManager.getInstance(context).getWorkInfosForUniqueWork(MonitorWork.NAME).get(10, TimeUnit.SECONDS).count { !it.state.isFinished })
        // A short one-shot QA job uses the production Worker after process reclamation.
        WorkManager.getInstance(context).enqueueUniqueWork("qa-cold-restart", ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<MonitorWorker>().setInitialDelay(10, TimeUnit.SECONDS).build()).result.get(10, TimeUnit.SECONDS)
    }

}
