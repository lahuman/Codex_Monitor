package local.codex_lb.desktop.preview

import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.FrameLayout
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.Espresso.onData
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.swipeUp
import androidx.test.espresso.action.ViewActions.scrollTo
import androidx.test.espresso.matcher.ViewMatchers.withContentDescription
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
import org.hamcrest.Matchers.anything
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

@RunWith(AndroidJUnit4::class)
class GraphicalWidgetTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val now = System.currentTimeMillis()/1000
    private val prefs get() = context.getSharedPreferences("monitor_widget", 0)
    @Before fun fixture() {
        assumeTrue("Dedicated empty emulator only", Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk"))
        prefs.edit().clear().putInt("minutes", 0).putInt("active_count", 0).putString("snapshot", fixtureJson()).commit()
        MonitorWork.reconcile(context, true)
    }
    private fun fixtureJson(): String {
        val rows = JSONArray()
        val names = listOf("업무 계정", "개인 계정", "리서치", "프로젝트 A", "디자인", "개발 계정")
        repeat(6) { i -> rows.put(JSONObject().put("id", "qa-account-$i").put("name", names[i]).put("observed_at", now).put("status", "마지막 관측").put("vouchers", if (i == 0) 3 else 0).put("windows", JSONArray()
            .put(JSONObject().put("label", "5시간").put("remaining", listOf(84,37,8,63,0,100)[i]).put("reset_at", now+14400))
            .put(JSONObject().put("label", "주간").put("remaining", listOf(95,60,18,72,32,49)[i]).put("reset_at", now+518400)))) }
        return JSONObject().put("version", 2).put("accounts", rows).put("total", 6).put("active_count", 6).toString()
    }
    private fun allText(view: View): String = if (view is TextView) view.text.toString() else if (view is ViewGroup) (0 until view.childCount).joinToString("\n") { allText(view.getChildAt(it)) } else ""
    private fun render(settings: WidgetSettings, data: WidgetData = WidgetData.read(context), width: Int = 320, height: Int = 260, screenshot: String? = null, renderContext: Context = context, inspect: ((View) -> Unit)? = null): String {
        var text = ""
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val parent = FrameLayout(renderContext)
            val view = WidgetRenderer.create(renderContext, settings, data, width, height, now = now).apply(renderContext, parent)
            val density = renderContext.resources.displayMetrics.density
            val w = (width*density).toInt(); val h = (height*density).toInt()
            view.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY)); view.layout(0,0,w,h)
            text = allText(view)
            if (screenshot != null) {
                val image = Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888); view.draw(Canvas(image))
                val file = File(context.filesDir, "widget-qa/$screenshot.png"); file.parentFile!!.mkdirs()
                file.outputStream().use { image.compress(Bitmap.CompressFormat.PNG,100,it) }; image.recycle()
            }
            inspect?.invoke(view)
        }
        return text
    }
    @Test fun catalogueAcceptsSelectedAccountBeyondFourAndRejectsMalformedValues() {
        val data = WidgetData.parse(fixtureJson())
        assertEquals(6,data.accounts.size)
        val text = render(WidgetSettings(accountId="qa-account-5"))
        assertTrue(text.contains("개발 계정")); assertTrue(text.contains("100%")); assertFalse(text.contains("업무 계정"))
        val malformed = JSONObject(fixtureJson()); malformed.getJSONArray("accounts").getJSONObject(0).getJSONArray("windows").getJSONObject(0).put("remaining",101)
        assertThrows(IllegalArgumentException::class.java) { WidgetData.parse(malformed.toString()) }
        val duplicate = JSONObject(fixtureJson()); duplicate.getJSONArray("accounts").getJSONObject(1).put("id","qa-account-0")
        assertThrows(IllegalArgumentException::class.java) { WidgetData.parse(duplicate.toString()) }
    }
    @Test fun independentSettingsSurviveRestoreAndDeletedAccountDoesNotSwitch() {
        val one = WidgetSettings("qa-account-0", WidgetGraph.RINGS, WidgetTheme.DARK, false)
        val two = WidgetSettings("qa-account-5", WidgetGraph.BARS, WidgetTheme.LIGHT, true)
        val manager = AppWidgetManager.getInstance(context)
        val host = AppWidgetHost(context, 868)
        val ids = IntArray(4) { host.allocateAppWidgetId() }
        try {
            ids.forEach { assertTrue(manager.bindAppWidgetIdIfAllowed(it, ComponentName(context, MonitorWidget::class.java))) }
            WidgetSettings.save(context, ids[0], one); WidgetSettings.save(context, ids[1], two)
            MonitorWidget().onRestored(context, ids.take(2).toIntArray(), ids.drop(2).toIntArray())
            assertEquals(one, WidgetSettings.read(context, ids[2])); assertEquals(two, WidgetSettings.read(context, ids[3]))
            MonitorWidget().onDeleted(context, intArrayOf(ids[2]))
            assertEquals(WidgetSettings(), WidgetSettings.read(context, ids[2])); assertEquals(two, WidgetSettings.read(context, ids[3]))
        } finally { ids.forEach(host::deleteAppWidgetId); WidgetSettings.delete(context, ids) }
        val data = WidgetData.read(context); val missing = data.copy(accounts=data.accounts.filter { it.id != "qa-account-5" },total=5)
        val text = render(two,missing)
        assertTrue(text.contains("선택한 계정을 찾을 수 없습니다"));assertFalse(text.contains("84%"))
    }
    @Test fun realRemoteViewsRenderLightDarkResizedUnknownAndPrivateStates() {
        render(WidgetSettings("qa-account-0",theme=WidgetTheme.LIGHT),screenshot="rings-light")
        render(WidgetSettings("qa-account-1",theme=WidgetTheme.DARK),screenshot="rings-dark")
        render(WidgetSettings("qa-account-1",graph=WidgetGraph.BARS,theme=WidgetTheme.LIGHT),screenshot="bars-light")
        val summary = render(WidgetSettings(theme=WidgetTheme.LIGHT),height=420,screenshot="overview-light")
        assertTrue(summary.contains("3/6계정"))
        val compact = render(WidgetSettings(theme=WidgetTheme.DARK),width=180,height=180,screenshot="overview-compact")
        assertTrue(compact.contains("1/6계정"))
        val hidden = render(WidgetSettings("qa-account-0",hideNames=true),width=180,height=180,screenshot="rings-compact-private")
        assertTrue(hidden.contains("계정 1"));assertFalse(hidden.contains("업무 계정"))
        val data = WidgetData.read(context)
        val a = data.accounts[0].copy(status="조회 실패",windows=listOf(WidgetWindow("5시간",null,null),WidgetWindow("주간",0.0,null)))
        val text = render(WidgetSettings(a.id), data.copy(accounts=listOf(a),total=1), screenshot="unknown-error")
        assertTrue(text.contains("—"));assertTrue(text.contains("0%"));assertTrue(text.contains("조회 실패"))
        assertEquals(0,prefs.getInt("minutes",-1));assertFalse(prefs.contains("last_worker_at"))
    }
    @Test fun twoSingleWindowAccountsStayCompactInTallAndShortAllocations() {
        val original = WidgetData.read(context)
        val data = original.copy(accounts = original.accounts.take(2).mapIndexed { i, a ->
            a.copy(name = if (i == 0) "sm" else "ge", windows = listOf(WidgetWindow("주간", if (i == 0) 48.0 else 68.0, now + 518400)))
        }, total = 2)
        var shortHeight = 0
        for (height in listOf(180, 320)) {
            val text = render(WidgetSettings(theme = WidgetTheme.LIGHT), data, 280, height, "compact-two-$height") { view ->
                val card = view.findViewById<View>(R.id.widget_root)
                val density = context.resources.displayMetrics.density
                assertTrue("Card fits the compact allocation: ${card.height / density}dp (available $height)", card.height <= 180 * density)
                if (height == 180) shortHeight = card.height else assertEquals("Extra launcher height must not stretch the card", shortHeight, card.height)
                val rows = view.findViewById<ViewGroup>(R.id.widget_accounts)
                assertEquals(2, rows.childCount)
                assertTrue("Rows must follow the header without an empty band", rows.top <= 56 * density)
                val footer = view.findViewById<View>(R.id.widget_status)
                assertTrue("Footer follows the rows", footer.top - rows.bottom <= 4 * density + 1)
                assertTrue("Content must remain inside the card", footer.bottom <= card.height)
            }
            assertTrue(text.contains("48%")); assertTrue(text.contains("68%")); assertTrue(text.contains("2/2계정"))
        }
        render(WidgetSettings("qa-account-0"), original, 180, 160, "compact-rings-160")
        render(WidgetSettings("qa-account-0", graph = WidgetGraph.BARS), original, 180, 160, "compact-bars-160")
    }
    @Test fun horizontalQuotasKeepThickTrackAndValueOnTheSameRow() {
        fun checkRows(view: View) {
            if (view is ViewGroup) {
                val value = (0 until view.childCount).map { view.getChildAt(it) }.firstOrNull { it.id == R.id.widget_window_value }
                if (value != null) {
                    val graph = view.findViewById<View>(R.id.widget_graph)
                    val density = context.resources.displayMetrics.density
                    assertTrue("Percentage follows the graph", value.left > graph.right)
                    assertTrue("Bar is at least 12dp thick", graph.height >= 12 * density - 1)
                    assertTrue("Bar remains visible on narrow widgets", graph.width >= 16 * density)
                    assertTrue("Value and bar share the same row center", kotlin.math.abs((value.top + value.bottom) - (graph.top + graph.bottom)) <= 2)
                    assertTrue("Percentage stays inside the row", value.right <= view.width)
                }
                (0 until view.childCount).forEach { checkRows(view.getChildAt(it)) }
            }
        }
        for (width in listOf(180, 280, 360)) {
            render(WidgetSettings(theme = WidgetTheme.LIGHT), width = width, height = 420, screenshot = "inline-overview-$width", inspect = ::checkRows)
            render(WidgetSettings("qa-account-5", WidgetGraph.BARS, WidgetTheme.DARK), width = width, height = 160, screenshot = "inline-bars-$width", inspect = ::checkRows)
        }
    }
    @Test fun headerShowsOneObservedTimestampAndPeriodsKeepTheirOwnResetTimes() {
        val original = WidgetData.read(context)
        val data = original.copy(accounts = listOf(original.accounts[0], original.accounts[1].copy(observedAt = now - 3600)), total = 2)
        fun stamp(at: Long) = java.text.SimpleDateFormat("MM/dd HH:mm", java.util.Locale.getDefault()).format(java.util.Date(at * 1000))
        val text = render(WidgetSettings(theme = WidgetTheme.LIGHT), data, 280, 320, "reset-times-overview") { view ->
            val header = view.findViewById<TextView>(R.id.widget_updated)
            assertEquals(stamp(now), header.text.toString())
            val card = view.findViewById<ViewGroup>(R.id.widget_root)
            val control = view.findViewById<View>(R.id.widget_settings)
            assertTrue("Update stamp is in the right header", control.right + (control.parent as View).left >= card.width - 10 * context.resources.displayMetrics.density)
            fun checkReset(node: View) {
                if (node.id == R.id.widget_window_reset && node is TextView) {
                    assertEquals(View.VISIBLE, node.visibility)
                    assertTrue(node.text.toString() == "↻ " + stamp(now + 14400) || node.text.toString() == "↻ " + stamp(now + 518400))
                    assertNotNull(node.layout)
                    assertEquals("Reset date must not be ellipsized", 0, node.layout.getEllipsisCount(0))
                }
                if (node is ViewGroup) (0 until node.childCount).forEach { checkReset(node.getChildAt(it)) }
            }
            checkReset(view)
        }
        assertEquals("Update timestamp occurs only once", 1, text.split(stamp(now)).size - 1)
        assertFalse(text.contains(stamp(now - 3600)))
        assertTrue(text.contains("이전 관측"))
        for (graph in WidgetGraph.entries) {
            render(WidgetSettings("qa-account-0", graph, WidgetTheme.DARK), original, 180, 160, "reset-times-compact-${graph.name}") { view ->
                fun check(node: View) {
                    if (node.id == R.id.widget_window_reset && node is TextView) {
                        assertEquals(View.VISIBLE, node.visibility)
                        assertTrue(node.text.toString().startsWith("↻ "))
                        assertEquals(0, node.layout.getEllipsisCount(0))
                    }
                    if (node is ViewGroup) (0 until node.childCount).forEach { check(node.getChildAt(it)) }
                }
                check(view)
                val card = view.findViewById<View>(R.id.widget_root)
                val footer = view.findViewById<View>(R.id.widget_status)
                assertTrue("Compact reset times must not push footer outside the card", footer.bottom <= card.height)
            }
        }
    }
    @Test fun resetTimesRemainReadableAcrossDensityFontScaleAndAllocation() {
        val original = WidgetData.read(context)
        val stamp = java.text.SimpleDateFormat("MM/dd HH:mm", java.util.Locale.getDefault())
        val data = original.copy(accounts = original.accounts.take(2).mapIndexed { i, a ->
            a.copy(name = if (i == 0) "sm" else "ge", windows = listOf(WidgetWindow("주간", if (i == 0) 19.0 else 68.0, now + (i+6)*86400)))
        }, total = 2)
        fun assertVisibleText(node: TextView) {
            val layout = node.layout
            assertNotNull(layout)
            assertTrue("All text reaches layout: ${node.text}", layout.getLineEnd(layout.lineCount - 1) >= node.text.length)
            for (line in 0 until layout.lineCount) {
                assertEquals("No ellipsis: ${node.text}", 0, layout.getEllipsisCount(line))
                assertTrue("Text fits width: ${node.text}", layout.getLineWidth(line) <= node.width - node.totalPaddingLeft - node.totalPaddingRight + 1)
            }
            assertTrue("All lines fit text height: ${node.text}", layout.height <= node.height - node.totalPaddingTop - node.totalPaddingBottom + 1)
            var child: View = node
            while (child.parent is View) {
                val parent = child.parent as View
                assertTrue("Text ancestor fits vertically: ${node.text}", child.top >= 0 && child.bottom <= parent.height)
                child = parent
            }
        }
        for (dpi in listOf(160, 420, 480)) for (scale in listOf(1f, 1.3f, 1.5f)) for (width in listOf(180, 280, 360)) {
            val configuration = android.content.res.Configuration(context.resources.configuration).apply { densityDpi = dpi; fontScale = scale }
            val scaled = context.createConfigurationContext(configuration)
            for (setting in listOf(WidgetSettings(theme = WidgetTheme.LIGHT), WidgetSettings("qa-account-0", WidgetGraph.BARS), WidgetSettings("qa-account-0", WidgetGraph.RINGS))) {
                val source = if (setting.accountId == null) data else original
                val screenshot = if (dpi == 420 && width == 280 && setting.accountId == null) "responsive-font-$scale" else null
                var resets = 0
                render(setting, source, width, 320, screenshot, scaled) { view ->
                    fun check(node: View) {
                        if (node is TextView && (node.id == R.id.widget_window_reset || node.id == R.id.widget_updated)) {
                            assertVisibleText(node)
                            if (node.id == R.id.widget_window_reset) {
                                resets++
                                assertTrue(source.accounts.flatMap { it.windows }.any { "↻ " + stamp.format(java.util.Date(it.resetAt!! * 1000)) == node.text.toString() })
                                val expected = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_SP, 11f, scaled.resources.displayMetrics)
                                assertEquals("Test must use the requested font configuration", expected, node.textSize, 0.51f)
                            }
                        }
                        if (node is ViewGroup) (0 until node.childCount).forEach { check(node.getChildAt(it)) }
                    }
                    check(view)
                    assertTrue("At least one account remains readable", resets >= 1)
                    assertTrue(view.findViewById<View>(R.id.widget_root).bottom <= view.height)
                }
            }
        }
        val large = context.createConfigurationContext(android.content.res.Configuration(context.resources.configuration).apply { fontScale = 2f })
        val text = render(WidgetSettings("qa-account-0", WidgetGraph.BARS), original, 180, 160, "responsive-resize-hint", large) { view ->
            assertVisibleText(view.findViewById(R.id.widget_message))
            assertTrue(view.findViewById<View>(R.id.widget_root).bottom <= view.height)
        }
        assertTrue(text.contains("위젯을 키워 주세요"))
        assertFalse(text.contains("84%"))
        assertEquals(0, prefs.getInt("minutes", -1)); assertFalse(prefs.contains("last_worker_at"))
    }
    @Test fun missingAndFutureObservationTimesDoNotInventAnUpdate() {
        val original = WidgetData.read(context)
        for (at in listOf<Long?>(null, now + 600)) {
            val account = original.accounts[0].copy(observedAt = at, windows = listOf(WidgetWindow("주간", 0.0, null)))
            val text = render(WidgetSettings(account.id, WidgetGraph.BARS), original.copy(accounts = listOf(account), total = 1), screenshot = if (at == null) "reset-times-unknown" else "reset-times-future") { view ->
                assertEquals(if (at == null) "관측 전" else "시각 확인", view.findViewById<TextView>(R.id.widget_updated).text.toString())
            }
            assertTrue(text.contains("↻ 미확인")); assertTrue(text.contains("0%"))
        }
    }
    @Test fun configurationCanSaveAndCancelForRealBoundWidget() {
        val manager = AppWidgetManager.getInstance(context)
        val host = AppWidgetHost(context,866)
        val id = host.allocateAppWidgetId()
        try {
            assertTrue("Grant widget bind permission to dedicated test app",manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,MonitorWidget::class.java)))
            assertEquals(0,manager.getAppWidgetInfo(id).updatePeriodMillis)
            assertEquals(WidgetConfigurationActivity::class.java.name,manager.getAppWidgetInfo(id).configure.className)
            manager.updateAppWidgetOptions(id,Bundle().apply { putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,280);putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,260) })
            WidgetSettings.save(context,id,WidgetSettings("qa-account-0"))
            ActivityScenario.launch<WidgetConfigurationActivity>(Intent(context,WidgetConfigurationActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id)).use {
                onView(withContentDescription("표시 계정")).perform(scrollTo(),click())
                onData(anything()).atPosition(6).perform(click())
                onView(isAssignableFrom(android.widget.ScrollView::class.java)).perform(swipeUp())
                onView(withText("위젯 저장")).perform(click())
            }
            assertEquals("qa-account-5",WidgetSettings.read(context,id).accountId)
            ActivityScenario.launch<WidgetConfigurationActivity>(Intent(context,WidgetConfigurationActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id)).use {
                onView(withContentDescription("표시 계정")).perform(scrollTo(),click())
                onData(anything()).atPosition(1).perform(click())
                onView(isAssignableFrom(android.widget.ScrollView::class.java)).perform(swipeUp())
                onView(withText("취소")).perform(click())
            }
            assertEquals("qa-account-5",WidgetSettings.read(context,id).accountId)
            MonitorWidget.update(context,id)
        } finally { host.deleteAppWidgetId(id);WidgetSettings.delete(context,intArrayOf(id)) }
    }
    @Test fun pinCallbackVerifiesOwnerAndOnlyPersistsConfirmedWidget() {
        val manager=AppWidgetManager.getInstance(context);val host=AppWidgetHost(context,867);val id=host.allocateAppWidgetId()
        try {
            assertTrue(manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,MonitorWidget::class.java)))
            val setting=WidgetSettings("qa-account-3",WidgetGraph.BARS,WidgetTheme.DARK,true)
            val intent=Intent(context,MonitorWidget::class.java).setAction(MonitorWidget.PINNED).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id).putExtra(MonitorWidget.SETTINGS,setting.encode())
            MonitorWidget().onReceive(context,intent)
            assertEquals(setting,WidgetSettings.read(context,id))
            MonitorWidget().onReceive(context,Intent(intent).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,99999))
            assertEquals(WidgetSettings(),WidgetSettings.read(context,99999))
        } finally {host.deleteAppWidgetId(id);WidgetSettings.delete(context,intArrayOf(id))}
    }
}
