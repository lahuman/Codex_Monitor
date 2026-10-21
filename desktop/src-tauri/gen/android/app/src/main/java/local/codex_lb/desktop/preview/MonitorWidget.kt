package local.codex_lb.desktop.preview

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews

class MonitorWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { update(context, it) } }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { update(context, id) }
    override fun onDeleted(context: Context, ids: IntArray) { WidgetSettings.delete(context, ids) }
    override fun onRestored(context: Context, oldWidgetIds: IntArray, newWidgetIds: IntArray) {
        WidgetSettings.restore(context, oldWidgetIds, newWidgetIds)
        val manager = AppWidgetManager.getInstance(context)
        newWidgetIds.forEach { id ->
            manager.updateAppWidgetOptions(id, Bundle().apply { putBoolean(AppWidgetManager.OPTION_APPWIDGET_RESTORE_COMPLETED, true) })
            update(context, id)
        }
    }
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == PINNED) {
            val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (!owns(context, id)) return
            val encoded = intent.getStringExtra(SETTINGS) ?: return
            val settings = try { WidgetSettings.decode(encoded) } catch (_: IllegalArgumentException) { return } catch (_: org.json.JSONException) { return }
            WidgetSettings.save(context, id, settings)
            update(context, id)
        } else super.onReceive(context, intent)
    }
    companion object {
        const val PINNED = "local.codex_lb.desktop.preview.WIDGET_PINNED"
        const val SETTINGS = "widget_settings"
        fun owns(context: Context, id: Int) = id > 0 && AppWidgetManager.getInstance(context).getAppWidgetInfo(id)?.provider == ComponentName(context, MonitorWidget::class.java)
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            manager.getAppWidgetIds(ComponentName(context, MonitorWidget::class.java)).forEach { update(context, it) }
        }
        fun update(context: Context, id: Int) {
            val manager = AppWidgetManager.getInstance(context)
            val options = manager.getAppWidgetOptions(id)
            val data = WidgetData.read(context)
            val settings = WidgetSettings.read(context, id)
            // Android selects the orientation-specific layout. Only two bounded
            // bitmap sets are sent, rather than a bitmap for every possible size.
            val portrait = WidgetRenderer.create(context, settings, data, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 280).coerceIn(180, 800), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 180).coerceIn(160, 800), id)
            val landscape = WidgetRenderer.create(context, settings, data, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 400).coerceIn(180, 800), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 160).coerceIn(160, 800), id)
            manager.updateAppWidget(id, RemoteViews(landscape, portrait))
        }
    }
}
