package local.codex_lb.desktop.preview

import android.content.Context

object MonitorSnapshot {
    fun save(context: Context, text: String) {
        val snapshot = WidgetData.parse(text)
        val active = snapshot.activeCount
        val preferences = context.getSharedPreferences("monitor_widget", 0)
        val changed = preferences.getString("snapshot", null) != text
        preferences.edit().putString("snapshot", text).putInt("active_count", active).apply()
        MonitorWork.reconcile(context)
        if (changed) MonitorWidget.updateAll(context)
    }
}
