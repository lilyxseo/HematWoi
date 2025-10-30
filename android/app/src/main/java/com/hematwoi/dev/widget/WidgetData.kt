package com.hematwoi.dev.widget

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONException
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val PREF_NAME = "widget_summary_cache"
private const val PREF_KEY = "widget_summary_json"
private const val TAG = "WidgetData"

val JAKARTA_ZONE: ZoneId = ZoneId.of("Asia/Jakarta")
private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
data class WidgetSummary(
    val dateIso: String,
    val currency: String,
    val incomeToday: Long,
    val expenseToday: Long,
    val netToday: Long,
    val countTxToday: Int,
    val updatedAt: Long
) {
    companion object {
        fun default(): WidgetSummary {
            val today = LocalDate.now(JAKARTA_ZONE).format(ISO_DATE)
            return WidgetSummary(
                dateIso = today,
                currency = "IDR",
                incomeToday = 0,
                expenseToday = 0,
                netToday = 0,
                countTxToday = 0,
                updatedAt = 0
            )
        }
    }
}

object WidgetStorage {
    fun save(context: Context, summary: WidgetSummary) {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val json = JSONObject()
        try {
            json.put("dateISO", summary.dateIso)
            json.put("currency", summary.currency)
            json.put("incomeToday", summary.incomeToday)
            json.put("expenseToday", summary.expenseToday)
            json.put("netToday", summary.netToday)
            json.put("countTxToday", summary.countTxToday)
            json.put("updatedAt", summary.updatedAt)
        } catch (error: JSONException) {
            Log.w(TAG, "Failed to build widget json", error)
        }
        prefs.edit().putString(PREF_KEY, json.toString()).apply()
    }

    fun load(context: Context): WidgetSummary {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val jsonString = prefs.getString(PREF_KEY, null) ?: return WidgetSummary.default()
        return parse(jsonString)
    }

    fun parse(jsonString: String?): WidgetSummary {
        if (jsonString.isNullOrBlank()) return WidgetSummary.default()
        return try {
            val json = JSONObject(jsonString)
            val dateIso = json.optString("dateISO")
            val parsedDate = runCatching { LocalDate.parse(dateIso, ISO_DATE) }.getOrElse {
                LocalDate.now(JAKARTA_ZONE)
            }
            val normalizedDate = parsedDate.format(ISO_DATE)
            val currency = json.optString("currency").ifBlank { "IDR" }
            val income = json.optLong("incomeToday")
            val expense = json.optLong("expenseToday")
            val net = json.optLong("netToday", income - expense)
            val count = json.optInt("countTxToday")
            val updated = json.optLong("updatedAt")
            WidgetSummary(
                dateIso = normalizedDate,
                currency = currency,
                incomeToday = income,
                expenseToday = expense,
                netToday = if (json.has("netToday")) net else income - expense,
                countTxToday = if (count < 0) 0 else count,
                updatedAt = updated
            )
        } catch (error: JSONException) {
            Log.w(TAG, "Failed to parse widget json", error)
            WidgetSummary.default()
        }
    }

    fun clear(context: Context) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(PREF_KEY).apply()
    }
}
