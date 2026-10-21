package local.codex_lb.desktop.preview

import android.content.Context
import org.json.JSONObject

data class WidgetWindow(val label: String, val remaining: Double?, val resetAt: Long?)
data class WidgetAccount(val id: String?, val name: String, val observedAt: Long?, val status: String, val windows: List<WidgetWindow>, val vouchers: Long?)
data class WidgetData(val accounts: List<WidgetAccount>, val total: Int, val activeCount: Int, val error: String? = null) {
    companion object {
        // 100 accounts is the service limit. 2 canonical windows and bounded names/ids
        // fit under 128 KiB; no tokens, provider JSON or history enter the launcher.
        const val MAX_CHARS = 131072
        fun parse(text: String): WidgetData {
            require(text.length <= MAX_CHARS)
            val root = JSONObject(text)
            require(root.optInt("version", 1) in 1..2)
            val rows = root.getJSONArray("accounts")
            require(rows.length() <= 100)
            val total = root.getInt("total")
            val active = root.getInt("active_count")
            require(total in rows.length()..100 && active in 0..total)
            val seen = mutableSetOf<String>()
            val accounts = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val id = if (row.isNull("id")) null else row.getString("id").also { require(it.isNotEmpty() && it.length <= 128 && seen.add(it)) }
                val name = row.getString("name").also { require(it.length <= 192) }
                val state = row.getString("status").also { require(it in listOf("정지", "조회 실패", "마지막 관측")) }
                val values = row.getJSONArray("windows")
                require(values.length() <= 2)
                val windows = (0 until values.length()).map { n ->
                    val value = values.getJSONObject(n)
                    val remaining = if (value.isNull("remaining")) null else value.getDouble("remaining").also { require(it.isFinite() && it in 0.0..100.0) }
                    WidgetWindow(value.getString("label").also { require(it.length <= 64) }, remaining, value.nullableLong("reset_at"))
                }
                WidgetAccount(id, name, row.nullableLong("observed_at"), state, windows, row.nullableLong("vouchers")?.also { require(it >= 0) })
            }
            return WidgetData(accounts, total, active)
        }
        fun read(context: Context): WidgetData {
            val text = context.getSharedPreferences("monitor_widget", 0).getString("snapshot", null) ?: return WidgetData(emptyList(), 0, 0)
            return try { parse(text) } catch (_: IllegalArgumentException) { invalid() } catch (_: org.json.JSONException) { invalid() }
        }
        private fun invalid() = WidgetData(emptyList(), 0, 0, "저장값을 읽지 못했습니다. 앱에서 다시 수집하세요.")
        private fun JSONObject.nullableLong(key: String): Long? = if (isNull(key)) null else getLong(key)
    }
}
