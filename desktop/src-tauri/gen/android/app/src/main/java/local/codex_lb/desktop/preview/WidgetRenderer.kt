package local.codex_lb.desktop.preview

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import android.widget.FrameLayout
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

data class WidgetPalette(val dark: Boolean) {
    val background = Color.parseColor(if (dark) "#242622" else "#FFFEFA")
    val text = Color.parseColor(if (dark) "#F2F3ED" else "#191B19")
    val muted = Color.parseColor(if (dark) "#AFB7AC" else "#626962")
    val track = Color.parseColor(if (dark) "#42483E" else "#E8ECE4")
    val accent = Color.parseColor(if (dark) "#E3AB92" else "#A9583E")
    fun tone(value: Double?, mutedValue: Boolean): Int = if (value == null || mutedValue) muted else Color.parseColor(when {
        value >= 50 -> if (dark) "#66D4B0" else "#08785B"
        value >= 25 -> if (dark) "#EDCB63" else "#856400"
        value >= 10 -> if (dark) "#F4AF6B" else "#A85310"
        else -> if (dark) "#FF9795" else "#BB3533"
    })
    companion object {
        fun resolve(context: Context, theme: WidgetTheme) = WidgetPalette(when (theme) {
            WidgetTheme.DARK -> true
            WidgetTheme.LIGHT -> false
            WidgetTheme.SYSTEM -> context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        })
    }
}

object WidgetRenderer {
    private fun time(at: Long?): String = at?.let {
        SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(Date(it * 1000))
    } ?: "관측 전"
    private fun percent(value: Double?) = value?.let { "${it.roundToInt()}%" } ?: "—"
    private fun current(account: WidgetAccount, now: Long) = account.status == "마지막 관측" && account.observedAt != null && account.observedAt <= now && now - account.observedAt <= 120
    private fun observationState(account: WidgetAccount, latest: Long?, now: Long): String? = when {
        account.status != "마지막 관측" -> account.status
        account.observedAt == null -> "관측 전"
        account.observedAt > now -> "시각 확인"
        latest != null && latest - account.observedAt > 120 -> "이전 관측"
        else -> null
    }
    // Measure native views with the host's actual font metrics instead of estimating
    // row height from dp constants. The same bounded bitmaps are reused as rows drop.
    private fun fits(context: Context, views: RemoteViews, width: Int, height: Int): Boolean {
        val density = context.resources.displayMetrics.density
        val view = views.apply(context, FrameLayout(context))
        view.measure(View.MeasureSpec.makeMeasureSpec((width * density).roundToInt(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        return view.measuredHeight <= (height * density).roundToInt()
    }
    private fun label(account: WidgetAccount, index: Int, settings: WidgetSettings) = if (settings.hideNames) "계정 ${index + 1}" else account.name
    private fun message(context: Context, value: String, palette: WidgetPalette): RemoteViews = RemoteViews(context.packageName, R.layout.widget_message).apply {
        setTextViewText(R.id.widget_message, value); setTextColor(R.id.widget_message, palette.muted)
    }
    // Each ring is 176² * 4 = 124 KiB, independent of display density. At most
    // two rings are sent in one RemoteViews, keeping well below Binder limits.
    private fun graphic(value: Double?, color: Int, palette: WidgetPalette, ring: Boolean): Bitmap {
        val bitmap = Bitmap.createBitmap(if (ring) 176 else 256, if (ring) 176 else 24, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = palette.track }
        if (ring) {
            paint.style = Paint.Style.STROKE; paint.strokeWidth = 14f; paint.strokeCap = Paint.Cap.ROUND
            val bounds = RectF(11f, 11f, 165f, 165f)
            canvas.drawArc(bounds, -90f, 360f, false, paint)
            if (value != null && value > 0) { paint.color = color; canvas.drawArc(bounds, -90f, (value * 3.6).toFloat(), false, paint) }
        } else {
            canvas.drawRoundRect(0f, 0f, 256f, 24f, 12f, 12f, paint)
            if (value != null && value > 0) { paint.color = color; canvas.drawRoundRect(0f, 0f, (value * 2.56).toFloat(), 24f, 12f, 12f, paint) }
        }
        return bitmap
    }
    private fun window(context: Context, value: WidgetWindow, layout: Int, palette: WidgetPalette, muted: Boolean, ring: Boolean, compact: Boolean, width: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layout)
        val color = palette.tone(value.remaining, muted)
        views.setTextViewText(R.id.widget_window_label, value.label)
        views.setTextColor(R.id.widget_window_label, palette.muted)
        views.setTextViewText(R.id.widget_window_value, percent(value.remaining))
        views.setTextColor(R.id.widget_window_value, color)
        if (!ring) views.setTextColor(R.id.widget_period_dot, color)
        views.setContentDescription(R.id.widget_window_value, "${value.label} 잔여 ${value.remaining?.let { "$it 퍼센트" } ?: "미확인"}")
        views.setImageViewBitmap(R.id.widget_graph, graphic(value.remaining, color, palette, ring))
        if (layout == R.layout.widget_quota_bar && !compact) {
            val gap = (4 * context.resources.displayMetrics.density).roundToInt()
            views.setViewPadding(R.id.widget_bar_root, 0, gap, 0, gap)
        }
        if (ring && (compact || width < 250)) views.setTextViewTextSize(R.id.widget_window_value, TypedValue.COMPLEX_UNIT_SP, if (compact) 16f else 20f)
        val resetText = value.resetAt?.let { "↻ ${time(it)}" } ?: "↻ 미확인"
        views.setTextViewText(R.id.widget_window_reset, resetText)
        views.setTextColor(R.id.widget_window_reset, palette.muted)
        views.setContentDescription(R.id.widget_window_reset, "${value.label} 초기화 예정 ${value.resetAt?.let { time(it) } ?: "시각 미제공"}")
        return views
    }
    fun create(context: Context, settings: WidgetSettings, data: WidgetData, width: Int, height: Int, widgetId: Int? = null, now: Long = System.currentTimeMillis()/1000): RemoteViews {
        val palette = WidgetPalette.resolve(context, settings.theme)
        val views = RemoteViews(context.packageName, R.layout.monitor_widget)
        views.setInt(R.id.widget_root, "setBackgroundResource", if (palette.dark) R.drawable.widget_background_dark else R.drawable.widget_background_light)
        val padding = (8 * context.resources.displayMetrics.density).roundToInt()
        views.setViewPadding(R.id.widget_root, padding, padding / 2, padding, padding / 2)
        views.setTextColor(R.id.widget_title, palette.text)
        views.setTextColor(R.id.widget_subtitle, palette.muted)
        views.setTextColor(R.id.widget_status, palette.muted)
        views.setTextColor(R.id.widget_update_label, palette.accent)
        views.setTextColor(R.id.widget_updated, palette.muted)
        if (width < 250) views.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, 15f)
        views.removeAllViews(R.id.widget_accounts)
        val effectiveHeight = (height / context.resources.configuration.fontScale.coerceAtLeast(1f)).toInt()
        val selected = settings.accountId?.let { id -> data.accounts.find { it.id == id } }
        var shown = if (data.error != null) emptyList() else if (settings.accountId != null) listOfNotNull(selected) else data.accounts.take(4)
        fun updateHeader(): Long? {
            val latest = shown.mapNotNull { it.observedAt }.filter { it <= now }.maxOrNull()
            val updated = latest?.let { time(it) } ?: if (shown.any { (it.observedAt ?: 0) > now }) "시각 확인" else "관측 전"
            views.setTextViewText(R.id.widget_updated, updated)
            views.setContentDescription(R.id.widget_settings, "위젯 표시 설정. 표시 계정 중 최근 갱신 $updated")
            return latest
        }
        val latest = updateHeader()
        views.setTextViewText(R.id.widget_title, if (settings.accountId == null) "전체 계정" else selected?.let { label(it, data.accounts.indexOf(it), settings) } ?: "계정 확인 필요")
        views.setTextViewText(R.id.widget_subtitle, "저장된 잔여 한도")
        views.setViewVisibility(R.id.widget_subtitle, if (settings.accountId == null) View.GONE else View.VISIBLE)
        val unavailable = data.error ?: if (settings.accountId != null && selected == null) "선택한 계정을 찾을 수 없습니다.\n설정에서 계정을 다시 선택하세요." else if (data.accounts.isEmpty()) "앱에서 계정을 연결한 뒤\n사용량을 수집해 주세요." else null
        if (unavailable != null) {
            views.addView(R.id.widget_accounts, message(context, unavailable, palette))
            views.setTextViewText(R.id.widget_status, "눌러서 앱 열기")
        } else if (selected != null) {
            val compact = effectiveHeight < 240
            val ring = settings.graph == WidgetGraph.RINGS
            val container = if (ring) RemoteViews(context.packageName, R.layout.widget_rings) else null
            selected.windows.forEach { value ->
                val layout = if (!ring) R.layout.widget_quota_bar else if (compact) R.layout.widget_quota_ring_compact else R.layout.widget_quota_ring
                val item = window(context, value, layout, palette, !current(selected, now), ring, compact, width)
                if (container != null) container.addView(R.id.widget_ring_windows, item) else views.addView(R.id.widget_accounts, item)
            }
            if (container != null) views.addView(R.id.widget_accounts, container)
            if (selected.windows.isEmpty()) views.addView(R.id.widget_accounts, message(context, "한도 미확인", palette))
            val state = observationState(selected, latest, now)
            val vouchers = selected.vouchers?.let { "초기화권 ${it}개" } ?: "초기화권 미확인"
            views.setTextViewText(R.id.widget_subtitle, vouchers + (state?.let { " · $it" } ?: ""))
            views.setTextViewText(R.id.widget_status, "↻ 한도 초기화 예정")
        } else {
            val rows = shown.mapIndexed { index, account ->
                val row = RemoteViews(context.packageName, R.layout.widget_account_row)
                row.setTextViewText(R.id.widget_row_name, label(account, index, settings)); row.setTextColor(R.id.widget_row_name, palette.text)
                row.setTextColor(R.id.widget_row_status, palette.muted)
                row.removeAllViews(R.id.widget_row_windows)
                if (account.windows.isEmpty()) row.addView(R.id.widget_row_windows, message(context, "한도 미확인", palette))
                account.windows.forEach { value -> row.addView(R.id.widget_row_windows, window(context, value, R.layout.widget_quota_bar, palette, !current(account, now), false, true, width)) }
                row
            }
            fun showRows() {
                val visibleLatest = updateHeader()
                views.removeAllViews(R.id.widget_accounts)
                rows.take(shown.size).forEachIndexed { index, row ->
                    val state = observationState(shown[index], visibleLatest, now)
                    row.setTextViewText(R.id.widget_row_status, state ?: "")
                    row.setViewVisibility(R.id.widget_row_status, if (state == null) View.GONE else View.VISIBLE)
                    views.addView(R.id.widget_accounts, row)
                }
                views.setTextViewText(R.id.widget_status, "${shown.size}/${data.total}계정 · ↻ 초기화 예정")
            }
            showRows()
            while (shown.size > 1 && !fits(context, views, width, height)) {
                shown = shown.dropLast(1)
                showRows()
            }
        }
        if (unavailable == null && !fits(context, views, width, height)) {
            shown = emptyList()
            updateHeader()
            views.removeAllViews(R.id.widget_accounts)
            val notice = message(context, "위젯을 키워 주세요", palette).apply {
                setViewPadding(R.id.widget_message, 0, 0, 0, 0)
            }
            views.addView(R.id.widget_accounts, notice)
            views.setViewVisibility(R.id.widget_subtitle, View.GONE)
            views.setViewVisibility(R.id.widget_status, View.GONE)
        }
        if (widgetId != null) {
            val open = PendingIntent.getActivity(context, widgetId, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, open)
            val editIntent = Intent(context, WidgetConfigurationActivity::class.java).setData(Uri.parse("codex-monitor://widget/$widgetId")).putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            val edit = PendingIntent.getActivity(context, widgetId, editIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_settings, edit)
        }
        return views
    }
}
