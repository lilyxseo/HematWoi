package com.hematwoi.dev.widget

import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.max

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridge : Plugin() {

    override fun load() {
        super.load()
        WidgetRefreshWorker.schedule(context)
    }

    @PluginMethod
    fun setWidgetData(call: PluginCall) {
        try {
            val summary = parseSummary(call)
            WidgetStorage.save(context, summary)
            WidgetUpdater.updateAll(context)
            WidgetRefreshWorker.schedule(context)
            call.resolve()
        } catch (error: Exception) {
            Log.e(TAG, "Failed to set widget data", error)
            call.reject("Failed to set widget data", error)
        }
    }

    @PluginMethod
    fun refresh(call: PluginCall) {
        WidgetUpdater.updateAll(context)
        WidgetRefreshWorker.schedule(context)
        call.resolve()
    }

    private fun parseSummary(call: PluginCall): WidgetSummary {
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

        return WidgetSummary(
            dateIso = date.format(DateTimeFormatter.ISO_DATE),
            currency = currency,
            incomeToday = safeIncome,
            expenseToday = safeExpense,
            netToday = netValue,
            countTxToday = safeCount,
            updatedAt = max(0L, updatedAt)
        )
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
