package local.codex_lb.desktop.preview

import android.app.Activity
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.UUID

// RemoteViews previews require framework views, matching the launcher inflater.
class WidgetConfigurationActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var selected = WidgetSettings()
    private lateinit var data: WidgetData
    private lateinit var preview: FrameLayout
    private lateinit var graph: Spinner
    private var ready = false
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)
        widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID && !MonitorWidget.owns(this, widgetId)) { finish(); return }
        selected = savedInstanceState?.getString("selection")?.let(WidgetSettings::decode) ?: if (widgetId > 0) WidgetSettings.read(this, widgetId) else WidgetSettings()
        data = WidgetData.read(this)
        val root = ScrollView(this)
        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(16), dp(24), dp(24)) }
        root.addView(body)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets -> val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()); view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets }
        setContentView(root)
        val palette = WidgetPalette.resolve(this, WidgetTheme.SYSTEM)
        root.setBackgroundColor(palette.background)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = !palette.dark
            isAppearanceLightNavigationBars = !palette.dark
        }
        fun text(value: String, size: Float, bold: Boolean = false) = TextView(this).apply {
            text = value; textSize = size; setTextColor(palette.text)
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(8), 0, dp(8)); body.addView(this)
        }
        text("나만의 한도 위젯", 25f, true)
        text("계정과 그래프를 선택하세요. 홈 화면에 여러 위젯을 따로 둘 수 있습니다.", 14f)
        preview = FrameLayout(this)
        body.addView(preview, LinearLayout.LayoutParams(-1, dp(200)).apply { topMargin = dp(12); bottomMargin = dp(12) })
        val accounts = data.accounts.filter { it.id != null }
        val ids = mutableListOf<String?>(null).apply { addAll(accounts.map { it.id }) }
        val labels = mutableListOf("전체 계정 · 비교 보기").apply { addAll(accounts.map { it.name }) }
        if (selected.accountId != null && selected.accountId !in ids) { ids.add(selected.accountId); labels.add("연결이 해제된 계정 · 다시 선택") }
        fun spinner(label: String, values: List<String>, initial: Int, changed: (Int) -> Unit): Spinner {
            text(label, 14f, true)
            return Spinner(this).apply {
                adapter = ArrayAdapter(this@WidgetConfigurationActivity, android.R.layout.simple_spinner_dropdown_item, values)
                minimumHeight = dp(48); contentDescription = label
                body.addView(this, LinearLayout.LayoutParams(-1, dp(48)))
                setSelection(initial.coerceAtLeast(0))
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) { changed(position); if (ready) renderPreview() }
                }
            }
        }
        spinner("표시 계정", labels, ids.indexOf(selected.accountId)) { selected = selected.copy(accountId = ids[it]); if (ready) graph.isEnabled = selected.accountId != null }
        graph = spinner("그래프 모양", listOf("원형 게이지", "가로 막대"), selected.graph.ordinal) { selected = selected.copy(graph = WidgetGraph.entries[it]) }
        graph.isEnabled = selected.accountId != null
        text("전체 계정은 막대로 비교합니다. 위젯이 커지면 최대 4개 계정을 보여줍니다.", 12f)
        spinner("위젯 테마", listOf("시스템 설정 따르기", "밝게", "어둡게"), selected.theme.ordinal) { selected = selected.copy(theme = WidgetTheme.entries[it]) }
        body.addView(Switch(this).apply {
            text = "계정 이름 숨기기"; textSize = 15f; minHeight = dp(48); isChecked = selected.hideNames
            setOnCheckedChangeListener { _, checked -> selected = selected.copy(hideNames = checked); renderPreview() }
        })
        text("그래프는 마지막 저장값입니다. 위젯을 그리거나 설정을 바꿀 때 추가 조회하지 않습니다.", 12f)
        body.addView(Button(this).apply {
            text = if (widgetId > 0) "위젯 저장" else "홈 화면에 추가"; isAllCaps = false; minHeight = dp(48)
            setOnClickListener { save() }
        }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(12) })
        body.addView(Button(this).apply { text = "취소"; isAllCaps = false; minHeight = dp(48); setOnClickListener { finish() } }, LinearLayout.LayoutParams(-1, dp(48)))
        ready = true
        renderPreview()
    }
    override fun onSaveInstanceState(outState: Bundle) { outState.putString("selection", selected.encode()); super.onSaveInstanceState(outState) }
    private fun renderPreview() {
        if (!::preview.isInitialized) return
        val width = (resources.displayMetrics.widthPixels / resources.displayMetrics.density).toInt() - 48
        preview.removeAllViews()
        preview.addView(WidgetRenderer.create(this, selected, data, width, 200).apply(this, preview), FrameLayout.LayoutParams(-1, -1))
        // The preview is not an interactive widget; real actions are assigned by the provider.
        preview.contentDescription = "위젯 미리보기"
    }
    private fun save() {
        try {
            if (widgetId > 0) {
                if (!MonitorWidget.owns(this, widgetId)) { finish(); return }
                WidgetSettings.save(this, widgetId, selected)
                MonitorWidget.update(this, widgetId)
                setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                finish()
            } else {
                val manager = AppWidgetManager.getInstance(this)
                if (!manager.isRequestPinAppWidgetSupported) { Toast.makeText(this, "홈 화면을 길게 눌러 Codex Monitor 위젯을 추가하세요.", Toast.LENGTH_LONG).show(); return }
                val callback = Intent(this, MonitorWidget::class.java).setAction(MonitorWidget.PINNED).setData(Uri.parse("codex-monitor://pin/${UUID.randomUUID()}")) .putExtra(MonitorWidget.SETTINGS, selected.encode())
                // Mutable is required for the launcher to fill in EXTRA_APPWIDGET_ID;
                // the intent is explicit and the receiver verifies widget ownership.
                val pending = PendingIntent.getBroadcast(this, 0, callback, PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_MUTABLE)
                val extras = Bundle().apply { putParcelable(AppWidgetManager.EXTRA_APPWIDGET_PREVIEW, WidgetRenderer.create(this@WidgetConfigurationActivity, selected, data, 280, 200)) }
                if (manager.requestPinAppWidget(ComponentName(this, MonitorWidget::class.java), extras, pending)) finish()
            }
        } catch (_: IllegalStateException) { Toast.makeText(this, "위젯 설정을 저장하지 못했습니다. 다시 시도하세요.", Toast.LENGTH_LONG).show() }
    }
}
