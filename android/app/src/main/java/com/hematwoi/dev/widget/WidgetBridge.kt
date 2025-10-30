package com.hematwoi.dev.widget

import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import kotlin.math.max

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridge : Plugin() {

    override fun load() {
        super.load()
        WidgetAutoRefreshWorker.schedule(context)
    }

    @PluginMethod
    fun setWidgetData(call: PluginCall) {
        try {
            val typeRaw = call.getString("type")
            val type = WidgetType.from(typeRaw)
            if (type == null) {
                val summary = parseLegacySummary(call)
                WidgetStorage.save(context, summary)
                WidgetUpdater.update(context, WidgetType.SUMMARY)
                WidgetAutoRefreshWorker.schedule(context)
                call.resolve()
                return
            }

            val payload = call.getObject("payload")
            if (payload == null) {
                call.reject("payload is required")
                return
            }
            when (type) {
                WidgetType.SUMMARY -> {
                    val summary = parseSummary(JSONObject(payload.toString()))
                    WidgetStorage.save(context, summary)
                }
                WidgetType.BUDGET -> {
                    val budget = parseBudget(JSONObject(payload.toString()))
                    WidgetStorage.save(context, budget)
                }
                WidgetType.GOAL -> {
                    val goal = parseGoal(JSONObject(payload.toString()))
                    WidgetStorage.save(context, goal)
                }
                WidgetType.CALENDAR -> {
                    val calendar = parseCalendar(JSONObject(payload.toString()))
                    WidgetStorage.save(context, calendar)
                }
                WidgetType.STATS -> {
                    val stats = parseStats(JSONObject(payload.toString()))
                    WidgetStorage.save(context, stats)
                }
            }
            WidgetUpdater.update(context, type)
            WidgetAutoRefreshWorker.schedule(context)
            call.resolve()
        } catch (error: Exception) {
            Log.e(TAG, "Failed to set widget data", error)
            call.reject("Failed to set widget data", error)
        }
    }

    @PluginMethod
    fun refreshAll(call: PluginCall) {
        WidgetUpdater.updateAll(context)
        WidgetAutoRefreshWorker.schedule(context)
        call.resolve()
    }

    private fun parseLegacySummary(call: PluginCall): SummaryWidgetData {
        val dateRaw = call.getString("dateISO") ?: call.getString("date")
        val date = runCatching {
            if (dateRaw.isNullOrBlank()) {
                LocalDate.now(JAKARTA_ZONE)
            } else {
                LocalDate.parse(dateRaw, DateTimeFormatter.ISO_DATE)
            }
        }.getOrElse {
            LocalDate.now(JAKARTA_ZONE)
        }
        val currency = call.getString("currency")?.takeIf { it.isNotBlank() } ?: "IDR"
        val income = call.getLongOrDefault("incomeToday")
        val expense = call.getLongOrDefault("expenseToday")
        val netProvided = call.getOptionalLong("netToday")
        val count = call.getInt("countTxToday") ?: 0
        val updatedAt = call.getLongOrDefault("updatedAt", System.currentTimeMillis())

        val safeIncome = max(0L, income)
        val safeExpense = max(0L, expense)
        val netValue = netProvided ?: (safeIncome - safeExpense)
        val safeCount = if (count < 0) 0 else count

        return SummaryWidgetData(
            dateIso = date.format(DateTimeFormatter.ISO_DATE),
            currency = currency,
            incomeToday = safeIncome,
            expenseToday = safeExpense,
            netToday = netValue,
            countTxToday = safeCount,
            updatedAt = max(0L, updatedAt)
        )
    }

    private fun parseSummary(json: JSONObject): SummaryWidgetData {
        val dateIso = json.optString("date")
            .ifBlank { json.optString("dateISO") }
        val date = runCatching { LocalDate.parse(dateIso) }.getOrElse {
            LocalDate.now(JAKARTA_ZONE)
        }
        val currency = json.optString("currency").ifBlank { "IDR" }
        val income = json.optLong("incomeToday")
        val expense = json.optLong("expenseToday")
        val net = json.optLong("netToday", income - expense)
        val count = json.optInt("countTxToday").coerceAtLeast(0)
        val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
        return SummaryWidgetData(
            dateIso = date.format(DateTimeFormatter.ISO_DATE),
            currency = currency,
            incomeToday = income,
            expenseToday = expense,
            netToday = net,
            countTxToday = count,
            updatedAt = max(0L, updatedAt)
        )
    }

    private fun parseBudget(json: JSONObject): BudgetWidgetData {
        val monthRaw = json.optString("month").ifBlank { json.optString("monthISO") }
        val month = normalizeMonth(monthRaw)
        val currency = json.optString("currency").ifBlank { "IDR" }
        val total = json.optLong("totalBudget")
        val spent = json.optLong("expenseToDate")
        val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
        return BudgetWidgetData(
            month = month,
            currency = currency,
            totalBudget = max(0L, total),
            expenseToDate = max(0L, spent),
            updatedAt = max(0L, updatedAt)
        )
    }

    private fun parseGoal(json: JSONObject): GoalWidgetData {
        val name = json.optString("name").ifBlank { json.optString("title") }
        val currency = json.optString("currency").ifBlank { "IDR" }
        val target = json.optLong("targetAmount", json.optLong("target"))
        val saved = json.optLong("savedAmount", json.optLong("saved"))
        val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
        return GoalWidgetData(
            name = if (name.isBlank()) "—" else name,
            currency = currency,
            targetAmount = max(0L, target),
            savedAmount = max(0L, saved),
            updatedAt = max(0L, updatedAt)
        )
    }

    private fun parseCalendar(json: JSONObject): CalendarWidgetData {
        val monthRaw = json.optString("month")
        val month = normalizeMonth(monthRaw)
        val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
        val highlightsArray = json.optJSONArray("highlights") ?: JSONArray()
        val highlights = mutableListOf<CalendarHighlight>()
        for (i in 0 until highlightsArray.length()) {
            val item = highlightsArray.optJSONObject(i) ?: continue
            val dateIso = item.optString("date")
            val normalizedDate = normalizeDate(dateIso)
            val intensity = item.optInt("intensity", 0).coerceIn(0, 3)
            highlights.add(CalendarHighlight(normalizedDate, intensity))
        }
        return CalendarWidgetData(
            month = month,
            highlights = highlights,
            updatedAt = max(0L, updatedAt)
        )
    }

    private fun parseStats(json: JSONObject): StatsWidgetData {
        val monthRaw = json.optString("month")
        val month = normalizeMonth(monthRaw)
        val currency = json.optString("currency").ifBlank { "IDR" }
        val income = json.optLong("income")
        val expense = json.optLong("expense")
        val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
        val dailyArray = json.optJSONArray("daily") ?: JSONArray()
        val items = mutableListOf<StatsDailyEntry>()
        for (i in 0 until dailyArray.length()) {
            val obj = dailyArray.optJSONObject(i) ?: continue
            val dateIso = normalizeDate(obj.optString("date"))
            val value = obj.optLong("expense")
            items.add(StatsDailyEntry(dateIso, max(0L, value)))
        }
        return StatsWidgetData(
            month = month,
            currency = currency,
            income = max(0L, income),
            expense = max(0L, expense),
            updatedAt = max(0L, updatedAt),
            daily = items
        )
    }

    private fun normalizeMonth(raw: String?): String {
        if (raw.isNullOrBlank()) {
            return YearMonth.now(JAKARTA_ZONE).format(DateTimeFormatter.ofPattern("yyyy-MM"))
        }
        val monthValue = raw.take(7)
        val parsed = runCatching {
            YearMonth.parse(monthValue, DateTimeFormatter.ofPattern("yyyy-MM"))
        }.getOrElse {
            YearMonth.now(JAKARTA_ZONE)
        }
        return parsed.format(DateTimeFormatter.ofPattern("yyyy-MM"))
    }

    private fun normalizeDate(raw: String?): String {
        if (raw.isNullOrBlank()) {
            return LocalDate.now(JAKARTA_ZONE).format(DateTimeFormatter.ISO_DATE)
        }
        val value = raw.take(10)
        val parsed = runCatching { LocalDate.parse(value, DateTimeFormatter.ISO_DATE) }.getOrElse {
            LocalDate.now(JAKARTA_ZONE)
        }
        return parsed.format(DateTimeFormatter.ISO_DATE)
    }

    private fun PluginCall.getLongOrDefault(key: String, fallback: Long = 0L): Long {
        return getOptionalLong(key) ?: fallback
    }

    private fun PluginCall.getOptionalLong(key: String): Long? {
        val value = data.opt(key)
        return when (value) {
            is Number -> value.toLong()
            is String -> value.toLongOrNull()
            else -> null
        }
    }

    companion object {
        private const val TAG = "WidgetBridge"
    }
}
