package local.codex_lb.desktop.preview

import android.content.Context
import org.json.JSONObject

enum class WidgetGraph { RINGS, BARS }
enum class WidgetTheme { SYSTEM, LIGHT, DARK }
data class WidgetSettings(val accountId: String? = null, val graph: WidgetGraph = WidgetGraph.RINGS, val theme: WidgetTheme = WidgetTheme.SYSTEM, val hideNames: Boolean = false) {
    fun encode(): String = JSONObject().put("account", accountId ?: JSONObject.NULL).put("graph", graph.name).put("theme", theme.name).put("hide_names", hideNames).toString()
    companion object {
        fun decode(text: String): WidgetSettings {
            val value = JSONObject(text)
            val id = if (value.isNull("account")) null else value.getString("account").also { require(it.isNotEmpty() && it.length <= 128) }
            return WidgetSettings(id, WidgetGraph.valueOf(value.getString("graph")), WidgetTheme.valueOf(value.getString("theme")), value.getBoolean("hide_names"))
        }
        private fun prefs(context: Context) = context.getSharedPreferences("monitor_widget_instances", 0)
        fun read(context: Context, id: Int): WidgetSettings = try {
            prefs(context).getString(id.toString(), null)?.let(::decode) ?: WidgetSettings()
        } catch (_: IllegalArgumentException) { WidgetSettings() } catch (_: org.json.JSONException) { WidgetSettings() }
        fun save(context: Context, id: Int, value: WidgetSettings) { require(id > 0); check(prefs(context).edit().putString(id.toString(), value.encode()).commit()) }
        fun delete(context: Context, ids: IntArray) { val edit = prefs(context).edit(); ids.forEach { edit.remove(it.toString()) }; edit.apply() }
        fun restore(context: Context, old: IntArray, new: IntArray) {
            require(old.size == new.size)
            val values = old.map { read(context, it) }
            val edit = prefs(context).edit()
            old.forEach { edit.remove(it.toString()) }
            new.forEachIndexed { index, id -> edit.putString(id.toString(), values[index].encode()) }
            check(edit.commit())
        }
    }
}
