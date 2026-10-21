package local.codex_lb.desktop.preview

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject

@InvokeArg
class PublishArgs { var snapshot: String = "" }
@InvokeArg
class IntervalArgs { var minutes: Int = 10 }
@TauriPlugin
class MonitorWidgetPlugin(private val activity: Activity): Plugin(activity) {
    private val preferences get() = activity.getSharedPreferences("monitor_widget", 0)
    private fun result(): JSObject {
        val minutes = preferences.getInt("minutes", 10)
        val value = JSObject()
        value.put("minutes", minutes)
        value.put("background_minutes", if (minutes > 0) maxOf(15, minutes) else org.json.JSONObject.NULL)
        value.put("background_state", if (minutes == 0) "disabled" else if (preferences.getInt("active_count", 0) == 0) "no_accounts" else "scheduled")
        value.put("last_worker_at", if (preferences.contains("last_worker_at")) preferences.getLong("last_worker_at", 0) else org.json.JSONObject.NULL)
        value.put("last_worker_result", preferences.getString("last_worker_result", null) ?: org.json.JSONObject.NULL)
        return value
    }
    @Command
    fun settings(invoke: Invoke) { MonitorWork.reconcile(activity); invoke.resolve(result()) }
    @Command
    fun setInterval(invoke: Invoke) {
        val minutes = invoke.parseArgs(IntervalArgs::class.java).minutes
        if (minutes !in listOf(0,1,5,10,30,60,100)) { invoke.reject("Invalid interval"); return }
        preferences.edit().putInt("minutes", minutes).apply()
        MonitorWork.reconcile(activity, minutes == 0)
        MonitorWidget.updateAll(activity)
        invoke.resolve(result())
    }
    @Command
    fun pinWidget(invoke: Invoke) {
        activity.runOnUiThread {
            activity.startActivity(android.content.Intent(activity, WidgetConfigurationActivity::class.java))
            invoke.resolve()
        }
    }
    @Command
    fun publish(invoke: Invoke) {
        val text = invoke.parseArgs(PublishArgs::class.java).snapshot
        try { MonitorSnapshot.save(activity, text); invoke.resolve() }
        catch (_: Exception) { invoke.reject("Invalid widget snapshot") }
    }
}
