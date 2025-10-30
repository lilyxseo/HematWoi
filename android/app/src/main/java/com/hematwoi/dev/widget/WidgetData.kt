package com.hematwoi.dev.widget

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val PREF_NAME = "hw_widget_data"
private const val TAG = "WidgetData"

val JAKARTA_ZONE: ZoneId = ZoneId.of("Asia/Jakarta")

private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
private val ISO_MONTH: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM")
private val MONTH_LABEL: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMMM yyyy", Locale("id", "ID"))

enum class WidgetType(val key: String) {
    SUMMARY("summary"),
    BUDGET("budget"),
    GOAL("goal"),
    CALENDAR("calendar"),
    STATS("stats");

    companion object {
        fun from(raw: String?): WidgetType? {
            if (raw.isNullOrBlank()) return null
            return values().firstOrNull { it.key.equals(raw.trim(), ignoreCase = true) }
        }
    }
}

data class SummaryWidgetData(
    val dateIso: String,
    val currency: String,
    val incomeToday: Long,
    val expenseToday: Long,
    val netToday: Long,
    val countTxToday: Int,
    val updatedAt: Long
) {
    companion object {
        fun default(): SummaryWidgetData {
            val today = LocalDate.now(JAKARTA_ZONE).format(ISO_DATE)
            return SummaryWidgetData(
                dateIso = today,
                currency = "IDR",
                incomeToday = 0,
                expenseToday = 0,
                netToday = 0,
                countTxToday = 0,
                updatedAt = 0
            )
        }

        fun fromJson(json: JSONObject?): SummaryWidgetData {
            if (json == null) return default()
            return SummaryWidgetData(
                dateIso = normalizeDate(json.optString("date"), ISO_DATE),
                currency = json.optString("currency").ifBlank { "IDR" },
                incomeToday = json.optLong("incomeToday"),
                expenseToday = json.optLong("expenseToday"),
                netToday = json.optLong("netToday", json.optLong("incomeToday") - json.optLong("expenseToday")),
                countTxToday = json.optInt("countTxToday").coerceAtLeast(0),
                updatedAt = json.optLong("updatedAt")
            )
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("date", dateIso)
        put("currency", currency)
        put("incomeToday", incomeToday)
        put("expenseToday", expenseToday)
        put("netToday", netToday)
        put("countTxToday", countTxToday)
        put("updatedAt", updatedAt)
    }
}

data class BudgetWidgetData(
    val month: String,
    val currency: String,
    val totalBudget: Long,
    val expenseToDate: Long,
    val updatedAt: Long
) {
    companion object {
        fun default(): BudgetWidgetData {
            val currentMonth = YearMonth.now(JAKARTA_ZONE).format(ISO_MONTH)
            return BudgetWidgetData(
                month = currentMonth,
                currency = "IDR",
                totalBudget = 0,
                expenseToDate = 0,
                updatedAt = 0
            )
        }

        fun fromJson(json: JSONObject?): BudgetWidgetData {
            if (json == null) return default()
            val month = normalizeMonth(json.optString("month"))
            return BudgetWidgetData(
                month = month,
                currency = json.optString("currency").ifBlank { "IDR" },
                totalBudget = json.optLong("totalBudget"),
                expenseToDate = json.optLong("expenseToDate"),
                updatedAt = json.optLong("updatedAt")
            )
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("month", month)
        put("currency", currency)
        put("totalBudget", totalBudget)
        put("expenseToDate", expenseToDate)
        put("updatedAt", updatedAt)
    }

    fun monthLabel(): String {
        val parsed = runCatching { YearMonth.parse(month, ISO_MONTH) }.getOrElse {
            YearMonth.now(JAKARTA_ZONE)
        }
        return parsed.atDay(1).format(MONTH_LABEL)
    }
}

data class GoalWidgetData(
    val name: String,
    val currency: String,
    val targetAmount: Long,
    val savedAmount: Long,
    val updatedAt: Long
) {
    companion object {
        fun default(): GoalWidgetData = GoalWidgetData(
            name = "—",
            currency = "IDR",
            targetAmount = 0,
            savedAmount = 0,
            updatedAt = 0
        )

        fun fromJson(json: JSONObject?): GoalWidgetData {
            if (json == null) return default()
            return GoalWidgetData(
                name = json.optString("name").ifBlank { "—" },
                currency = json.optString("currency").ifBlank { "IDR" },
                targetAmount = json.optLong("targetAmount"),
                savedAmount = json.optLong("savedAmount"),
                updatedAt = json.optLong("updatedAt")
            )
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("name", name)
        put("currency", currency)
        put("targetAmount", targetAmount)
        put("savedAmount", savedAmount)
        put("updatedAt", updatedAt)
    }
}

data class CalendarHighlight(
    val dateIso: String,
    val intensity: Int
)

data class CalendarWidgetData(
    val month: String,
    val highlights: List<CalendarHighlight>,
    val updatedAt: Long
) {
    companion object {
        fun default(): CalendarWidgetData {
            val currentMonth = YearMonth.now(JAKARTA_ZONE).format(ISO_MONTH)
            return CalendarWidgetData(
                month = currentMonth,
                highlights = emptyList(),
                updatedAt = 0
            )
        }

        fun fromJson(json: JSONObject?): CalendarWidgetData {
            if (json == null) return default()
            val month = normalizeMonth(json.optString("month"))
            val highlightsJson = json.optJSONArray("highlights")
            val highlights = mutableListOf<CalendarHighlight>()
            if (highlightsJson != null) {
                for (i in 0 until highlightsJson.length()) {
                    val item = highlightsJson.optJSONObject(i) ?: continue
                    val dateIso = normalizeDate(item.optString("date"), ISO_DATE)
                    val intensity = item.optInt("intensity", 0).coerceIn(0, 3)
                    highlights.add(CalendarHighlight(dateIso, intensity))
                }
            }
            return CalendarWidgetData(
                month = month,
                highlights = highlights,
                updatedAt = json.optLong("updatedAt")
            )
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("month", month)
        val array = JSONArray()
        for (highlight in highlights) {
            array.put(JSONObject().apply {
                put("date", highlight.dateIso)
                put("intensity", highlight.intensity)
            })
        }
        put("highlights", array)
        put("updatedAt", updatedAt)
    }

    fun monthLabel(): String {
        val parsed = runCatching { YearMonth.parse(month, ISO_MONTH) }.getOrElse {
            YearMonth.now(JAKARTA_ZONE)
        }
        return parsed.atDay(1).format(MONTH_LABEL)
    }
}

data class StatsDailyEntry(
    val dateIso: String,
    val expense: Long
)

data class StatsWidgetData(
    val month: String,
    val currency: String,
    val income: Long,
    val expense: Long,
    val updatedAt: Long,
    val daily: List<StatsDailyEntry>
) {
    companion object {
        fun default(): StatsWidgetData {
            val currentMonth = YearMonth.now(JAKARTA_ZONE).format(ISO_MONTH)
            return StatsWidgetData(
                month = currentMonth,
                currency = "IDR",
                income = 0,
                expense = 0,
                updatedAt = 0,
                daily = emptyList()
            )
        }

        fun fromJson(json: JSONObject?): StatsWidgetData {
            if (json == null) return default()
            val month = normalizeMonth(json.optString("month"))
            val dailyArray = json.optJSONArray("daily")
            val items = mutableListOf<StatsDailyEntry>()
            if (dailyArray != null) {
                for (i in 0 until dailyArray.length()) {
                    val obj = dailyArray.optJSONObject(i) ?: continue
                    val dateIso = normalizeDate(obj.optString("date"), ISO_DATE)
                    val expense = obj.optLong("expense")
                    items.add(StatsDailyEntry(dateIso, expense))
                }
            }
            return StatsWidgetData(
                month = month,
                currency = json.optString("currency").ifBlank { "IDR" },
                income = json.optLong("income"),
                expense = json.optLong("expense"),
                updatedAt = json.optLong("updatedAt"),
                daily = items
            )
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("month", month)
        put("currency", currency)
        put("income", income)
        put("expense", expense)
        put("updatedAt", updatedAt)
        val array = JSONArray()
        for (item in daily) {
            array.put(JSONObject().apply {
                put("date", item.dateIso)
                put("expense", item.expense)
            })
        }
        put("daily", array)
    }

    fun monthLabel(): String {
        val parsed = runCatching { YearMonth.parse(month, ISO_MONTH) }.getOrElse {
            YearMonth.now(JAKARTA_ZONE)
        }
        return parsed.atDay(1).format(MONTH_LABEL)
    }
}

object WidgetStorage {
    fun save(context: Context, summary: SummaryWidgetData) {
        saveJson(context, WidgetType.SUMMARY, summary.toJson())
    }

    fun loadSummary(context: Context): SummaryWidgetData {
        return SummaryWidgetData.fromJson(loadJson(context, WidgetType.SUMMARY))
    }

    fun save(context: Context, budget: BudgetWidgetData) {
        saveJson(context, WidgetType.BUDGET, budget.toJson())
    }

    fun loadBudget(context: Context): BudgetWidgetData {
        return BudgetWidgetData.fromJson(loadJson(context, WidgetType.BUDGET))
    }

    fun save(context: Context, goal: GoalWidgetData) {
        saveJson(context, WidgetType.GOAL, goal.toJson())
    }

    fun loadGoal(context: Context): GoalWidgetData {
        return GoalWidgetData.fromJson(loadJson(context, WidgetType.GOAL))
    }

    fun save(context: Context, calendar: CalendarWidgetData) {
        saveJson(context, WidgetType.CALENDAR, calendar.toJson())
    }

    fun loadCalendar(context: Context): CalendarWidgetData {
        return CalendarWidgetData.fromJson(loadJson(context, WidgetType.CALENDAR))
    }

    fun save(context: Context, stats: StatsWidgetData) {
        saveJson(context, WidgetType.STATS, stats.toJson())
    }

    fun loadStats(context: Context): StatsWidgetData {
        return StatsWidgetData.fromJson(loadJson(context, WidgetType.STATS))
    }

    private fun saveJson(context: Context, type: WidgetType, json: JSONObject) {
        val prefs = prefs(context)
        val existing = prefs.getString(type.key, null)
        val normalized = json.toString()
        if (existing == normalized) return
        prefs.edit().putString(type.key, normalized).apply()
    }

    private fun loadJson(context: Context, type: WidgetType): JSONObject? {
        val raw = prefs(context).getString(type.key, null) ?: return null
        return try {
            JSONObject(raw)
        } catch (error: JSONException) {
            Log.w(TAG, "Failed to parse ${type.key} widget json", error)
            null
        }
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun clear(context: Context, type: WidgetType) {
        prefs(context).edit().remove(type.key).apply()
    }
}

private fun normalizeDate(value: String?, formatter: DateTimeFormatter): String {
    if (value.isNullOrBlank()) {
        return LocalDate.now(JAKARTA_ZONE).format(formatter)
    }
    val parsed = runCatching { LocalDate.parse(value.take(10), formatter) }.getOrElse {
        LocalDate.now(JAKARTA_ZONE)
    }
    return parsed.format(formatter)
}

private fun normalizeMonth(value: String?): String {
    if (value.isNullOrBlank()) {
        return YearMonth.now(JAKARTA_ZONE).format(ISO_MONTH)
    }
    val normalized = value.take(7)
    val parsed = runCatching { YearMonth.parse(normalized, ISO_MONTH) }.getOrElse {
        YearMonth.now(JAKARTA_ZONE)
    }
    return parsed.format(ISO_MONTH)
}
