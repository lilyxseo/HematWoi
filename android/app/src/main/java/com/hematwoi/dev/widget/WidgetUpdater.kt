package com.hematwoi.dev.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.hematwoi.dev.R
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max

object WidgetUpdater {
    private const val TAG = "WidgetUpdater"
    private const val REQUEST_OPEN_CALENDAR = 1001
    private const val REQUEST_OPEN_NEW_TX = 1002
    private val dateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM", Locale("id", "ID"))

    fun updateAll(context: Context, summaryOverride: WidgetSummary? = null) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, SummaryWidgetProvider::class.java)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(component)
        if (appWidgetIds.isEmpty()) {
            Log.d(TAG, "No widget instances to update")
            return
        }
        val summary = summaryOverride ?: WidgetStorage.load(context)
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, summary)
        }
    }

    fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        summary: WidgetSummary
    ) {
        val layoutId = selectLayout(appWidgetManager, appWidgetId)
        val views = RemoteViews(context.packageName, layoutId)

        val date = runCatching { LocalDate.parse(summary.dateIso) }.getOrElse {
            LocalDate.now(JAKARTA_ZONE)
        }
        val formattedDate = date.format(dateFormatter)
        val header = context.getString(R.string.widget_today_prefix, formattedDate)
        views.setTextViewText(R.id.widget_header, header)

        val updatedLabel = formatRelativeTime(summary.updatedAt)
        if (updatedLabel != null) {
            val subtitle = if (updatedLabel == "baru") {
                updatedLabel
            } else {
                context.getString(R.string.widget_updated_prefix, updatedLabel)
            }
            views.setTextViewText(R.id.widget_updated_at, subtitle)
            views.setViewVisibility(R.id.widget_updated_at, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_updated_at, View.GONE)
        }

        views.setTextViewText(
            R.id.widget_expense_value,
            MoneyFormatter.format(-summary.expenseToday, summary.currency)
        )
        views.setTextViewText(
            R.id.widget_income_value,
            MoneyFormatter.format(summary.incomeToday, summary.currency)
        )
        views.setTextViewText(
            R.id.widget_net_value,
            MoneyFormatter.format(summary.netToday, summary.currency, showPlusForPositive = true)
        )

        val countLabel = context.getString(R.string.widget_transactions_count, summary.countTxToday)
        views.setTextViewText(R.id.widget_transaction_count, countLabel)
        views.setContentDescription(
            R.id.widget_add_button,
            context.getString(R.string.widget_add_transaction)
        )

        val dateQuery = summary.dateIso
        val calendarIntent = createDeepLink(context, "calendar?d=$dateQuery", REQUEST_OPEN_CALENDAR)
        val newTxIntent = createDeepLink(context, "transactions/new", REQUEST_OPEN_NEW_TX)
        views.setOnClickPendingIntent(R.id.widget_root, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_content, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_add_button, newTxIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun selectLayout(appWidgetManager: AppWidgetManager, appWidgetId: Int): Int {
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 0
        val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) ?: 0
        val threshold = 180 // dp threshold for switching to large layout
        return if (minWidth >= threshold || minHeight >= threshold) {
            R.layout.widget_summary_large
        } else {
            R.layout.widget_summary
        }
    }

    private fun createDeepLink(context: Context, route: String, requestCode: Int): PendingIntent {
        val sanitizedRoute = if (route.startsWith("/")) route else "/$route"
        val uri = Uri.parse("app://hematwoi$sanitizedRoute")
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            setPackage(context.packageName)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, requestCode, intent, flags)
    }

    private fun formatRelativeTime(updatedAt: Long): String? {
        if (updatedAt <= 0) return null
        val now = System.currentTimeMillis()
        val diff = max(0L, now - updatedAt)
        if (diff < 60_000L) return "baru"
        val minutes = diff / 60_000L
        if (minutes < 60) return "${minutes}m"
        val hours = diff / 3_600_000L
        if (hours < 24) return "${hours}j"
        val days = diff / 86_400_000L
        return "${days}h"
    }
}
