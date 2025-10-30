package com.hematwoi.dev.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.hematwoi.dev.R
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

object WidgetUpdater {
    private const val PLACEHOLDER = "—"
    private const val REQUEST_OPEN_CALENDAR = 1001
    private const val REQUEST_OPEN_NEW_TX = 1002
    private val dateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("d MMM", Locale("id", "ID"))

    fun updateAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, SummaryWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) {
            return
        }
        val summary = WidgetStorage.load(context)
        for (appWidgetId in widgetIds) {
            updateWidget(context, manager, appWidgetId, summary)
        }
    }

    fun updateWidget(
        context: Context,
        manager: AppWidgetManager,
        appWidgetId: Int,
        summary: WidgetSummary
    ) {
        val layoutId = selectLayout(manager, appWidgetId)
        val views = RemoteViews(context.packageName, layoutId)

        val date = runCatching { LocalDate.parse(summary.dateIso) }.getOrElse {
            LocalDate.now(JAKARTA_ZONE)
        }
        val header = context.getString(R.string.widget_today_prefix, date.format(dateFormatter))
        views.setTextViewText(R.id.widget_header, header)

        val hasData = summary.updatedAt > 0
        views.setTextViewText(
            R.id.widget_expense_value,
            formatAmount(summary.expenseToday, hasData)
        )
        views.setTextViewText(
            R.id.widget_income_value,
            formatAmount(summary.incomeToday, hasData)
        )
        views.setTextViewText(
            R.id.widget_net_value,
            formatNet(summary.netToday, hasData)
        )
        views.setTextViewText(
            R.id.widget_transaction_count,
            formatCount(context, summary.countTxToday, hasData)
        )
        views.setContentDescription(
            R.id.widget_add_button,
            context.getString(R.string.widget_add_transaction)
        )

        val dateQuery = date.format(DateTimeFormatter.ISO_DATE)
        val calendarIntent = createDeepLink(context, "calendar?d=$dateQuery", REQUEST_OPEN_CALENDAR)
        val newTxIntent = createDeepLink(context, "transactions/new", REQUEST_OPEN_NEW_TX)
        views.setOnClickPendingIntent(R.id.widget_root, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_content, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_add_button, newTxIntent)

        manager.updateAppWidget(appWidgetId, views)
    }

    private fun selectLayout(manager: AppWidgetManager, appWidgetId: Int): Int {
        val options = manager.getAppWidgetOptions(appWidgetId)
        val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 0
        val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) ?: 0
        val threshold = 180
        return if (minWidth >= threshold || minHeight >= threshold) {
            R.layout.widget_summary_large
        } else {
            R.layout.widget_summary
        }
    }

    private fun formatAmount(value: Long, hasData: Boolean): String {
        if (!hasData) return PLACEHOLDER
        if (value == 0L) return "0"
        return MoneyFormatter.formatIDShort(value)
    }

    private fun formatNet(value: Long, hasData: Boolean): String {
        if (!hasData) return PLACEHOLDER
        if (value == 0L) return "0"
        val base = MoneyFormatter.formatIDShort(value)
        return if (value > 0) "+$base" else base
    }

    private fun formatCount(context: Context, count: Int, hasData: Boolean): String {
        if (!hasData) return PLACEHOLDER
        return context.getString(R.string.widget_transactions_count, count)
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
}
