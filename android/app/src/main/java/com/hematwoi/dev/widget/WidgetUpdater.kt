package com.hematwoi.dev.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import com.hematwoi.dev.R
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

object WidgetUpdater {
    private const val PLACEHOLDER = "—"
    private const val REQUEST_SUMMARY_CALENDAR = 1001
    private const val REQUEST_SUMMARY_NEW_TX = 1002
    private const val REQUEST_BUDGET = 2001
    private const val REQUEST_GOAL = 3001
    private const val REQUEST_CALENDAR = 4001
    private const val REQUEST_STATS = 5001
    private const val PROGRESS_MAX = 1000

    private val dateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("d MMM", Locale("id", "ID"))
    private val dayLabelFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("d", Locale.getDefault())

    fun updateAll(context: Context) {
        updateSummary(context)
        updateBudget(context)
        updateGoal(context)
        updateCalendar(context)
        updateStats(context)
    }

    fun update(context: Context, type: WidgetType) {
        when (type) {
            WidgetType.SUMMARY -> updateSummary(context)
            WidgetType.BUDGET -> updateBudget(context)
            WidgetType.GOAL -> updateGoal(context)
            WidgetType.CALENDAR -> updateCalendar(context)
            WidgetType.STATS -> updateStats(context)
        }
    }

    private fun updateSummary(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, SummaryWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) return
        val summary = WidgetStorage.loadSummary(context)
        widgetIds.forEach { appWidgetId ->
            val layoutId = selectSummaryLayout(manager, appWidgetId)
            val views = RemoteViews(context.packageName, layoutId)
            bindSummary(context, views, summary)
            manager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun bindSummary(context: Context, views: RemoteViews, summary: SummaryWidgetData) {
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

        val dateQuery = date.format(DateTimeFormatter.ISO_DATE)
        val calendarIntent = createDeepLink(context, "calendar?d=$dateQuery", REQUEST_SUMMARY_CALENDAR)
        val newTxIntent = createDeepLink(context, "transactions/new", REQUEST_SUMMARY_NEW_TX)
        views.setOnClickPendingIntent(R.id.widget_root, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_content, calendarIntent)
        views.setOnClickPendingIntent(R.id.widget_add_button, newTxIntent)
    }

    private fun updateBudget(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, BudgetWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) return
        val data = WidgetStorage.loadBudget(context)
        widgetIds.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_budget)
            bindBudget(context, views, data)
            manager.updateAppWidget(id, views)
        }
    }

    private fun bindBudget(context: Context, views: RemoteViews, data: BudgetWidgetData) {
        views.setTextViewText(R.id.widget_budget_month, data.monthLabel())

        val hasData = data.updatedAt > 0 && (data.totalBudget > 0 || data.expenseToDate > 0)
        val totalText = formatAmount(data.totalBudget, hasData)
        val expenseText = formatAmount(data.expenseToDate, hasData)
        val remaining = data.totalBudget - data.expenseToDate
        val remainingText = if (hasData) formatAmount(remaining, true) else PLACEHOLDER
        val progress = if (data.totalBudget > 0) {
            ((data.expenseToDate.toDouble() / data.totalBudget.toDouble()) * PROGRESS_MAX)
                .roundToInt()
                .coerceIn(0, PROGRESS_MAX)
        } else {
            0
        }
        val usedPercent = if (data.totalBudget > 0) {
            ((data.expenseToDate.toDouble() / data.totalBudget.toDouble()) * 100).roundToInt()
        } else {
            0
        }.coerceIn(0, 999)
        val remainingPercent = (100 - usedPercent).coerceIn(0, 999)

        views.setTextViewText(
            R.id.widget_budget_total_value,
            context.getString(R.string.widget_budget_total_value, totalText)
        )
        views.setTextViewText(
            R.id.widget_budget_spent_value,
            context.getString(R.string.widget_budget_spent_value, expenseText)
        )
        views.setTextViewText(
            R.id.widget_budget_badge,
            context.getString(R.string.widget_budget_remaining_badge, remainingPercent)
        )
        views.setTextViewText(
            R.id.widget_budget_remaining_value,
            context.getString(R.string.widget_budget_remaining_value, remainingText)
        )
        views.setProgressBar(R.id.widget_budget_progress, PROGRESS_MAX, progress, false)

        val intent = createDeepLink(context, "budget", REQUEST_BUDGET)
        views.setOnClickPendingIntent(R.id.widget_budget_root, intent)
    }

    private fun updateGoal(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, GoalWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) return
        val data = WidgetStorage.loadGoal(context)
        widgetIds.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_goal)
            bindGoal(context, views, data)
            manager.updateAppWidget(id, views)
        }
    }

    private fun bindGoal(context: Context, views: RemoteViews, data: GoalWidgetData) {
        views.setTextViewText(R.id.widget_goal_title, data.name.ifBlank { PLACEHOLDER })

        val hasData = data.updatedAt > 0 && data.targetAmount > 0
        val targetText = formatAmount(data.targetAmount, hasData)
        val savedText = formatAmount(data.savedAmount, hasData)
        val progress = if (data.targetAmount > 0) {
            ((data.savedAmount.toDouble() / data.targetAmount.toDouble()) * PROGRESS_MAX)
                .roundToInt()
                .coerceIn(0, PROGRESS_MAX)
        } else {
            0
        }
        val percent = if (data.targetAmount > 0) {
            ((data.savedAmount.toDouble() / data.targetAmount.toDouble()) * 100).roundToInt()
        } else {
            0
        }.coerceIn(0, 999)

        views.setTextViewText(
            R.id.widget_goal_target_value,
            context.getString(R.string.widget_goal_target_value, targetText)
        )
        views.setTextViewText(
            R.id.widget_goal_saved_value,
            context.getString(R.string.widget_goal_saved_value, savedText)
        )
        views.setTextViewText(
            R.id.widget_goal_percentage,
            context.getString(R.string.widget_goal_percentage_value, percent)
        )
        views.setProgressBar(R.id.widget_goal_progress, PROGRESS_MAX, progress, false)

        val intent = createDeepLink(context, "goals", REQUEST_GOAL)
        views.setOnClickPendingIntent(R.id.widget_goal_root, intent)
    }

    private fun updateCalendar(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, CalendarWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) return
        val data = WidgetStorage.loadCalendar(context)
        widgetIds.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_calendar)
            bindCalendar(context, views, data)
            manager.updateAppWidget(id, views)
        }
    }

    private fun bindCalendar(context: Context, views: RemoteViews, data: CalendarWidgetData) {
        val yearMonth = runCatching { YearMonth.parse(data.month) }.getOrElse {
            YearMonth.now(JAKARTA_ZONE)
        }
        val highlights = data.highlights.associate { highlight ->
            val day = runCatching { LocalDate.parse(highlight.dateIso).dayOfMonth }.getOrElse { 0 }
            day to highlight.intensity.coerceIn(0, 3)
        }
        views.setTextViewText(R.id.widget_calendar_month, data.monthLabel())

        val start = yearMonth.atDay(1)
        val totalDays = yearMonth.lengthOfMonth()
        val firstDayOfWeek = start.dayOfWeek
        val offset = ((firstDayOfWeek.value % 7) + 7) % 7
        val totalCells = 42
        var currentDay = 1

        val baseIntent = createDeepLink(context, "calendar", REQUEST_CALENDAR)
        views.setOnClickPendingIntent(R.id.widget_calendar_root, baseIntent)

        for (cell in 0 until totalCells) {
            val viewId = context.resources.getIdentifier("widget_calendar_cell_${cell + 1}", "id", context.packageName)
            if (viewId == 0) continue
            val labelId = context.resources.getIdentifier("widget_calendar_cell_label_${cell + 1}", "id", context.packageName)
            if (cell < offset || currentDay > totalDays) {
                if (labelId != 0) {
                    views.setTextViewText(labelId, "")
                }
                views.setInt(viewId, "setBackgroundResource", R.drawable.widget_heat_level_0)
                views.setOnClickPendingIntent(viewId, baseIntent)
            } else {
                val day = currentDay
                val label = start.withDayOfMonth(day).format(dayLabelFormatter)
                if (labelId != 0) {
                    views.setTextViewText(labelId, label)
                }
                val intensity = highlights[day] ?: 0
                val drawable = when (intensity) {
                    3 -> R.drawable.widget_heat_level_3
                    2 -> R.drawable.widget_heat_level_2
                    1 -> R.drawable.widget_heat_level_1
                    else -> R.drawable.widget_heat_level_0
                }
                views.setInt(viewId, "setBackgroundResource", drawable)
                val dateIso = yearMonth.atDay(day).format(DateTimeFormatter.ISO_DATE)
                val intent = createDeepLink(
                    context,
                    "calendar?d=$dateIso",
                    REQUEST_CALENDAR + day
                )
                views.setOnClickPendingIntent(viewId, intent)
                currentDay += 1
            }
        }

        DayOfWeek.values().forEachIndexed { index, dayOfWeek ->
            val id = context.resources.getIdentifier(
                "widget_calendar_weekday_${index + 1}",
                "id",
                context.packageName
            )
            if (id != 0) {
                val label = dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, Locale("id", "ID"))
                views.setTextViewText(id, label.uppercase(Locale.getDefault()))
            }
        }
    }

    private fun updateStats(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, StatsWidgetProvider::class.java)
        val widgetIds = manager.getAppWidgetIds(component)
        if (widgetIds.isEmpty()) return
        val data = WidgetStorage.loadStats(context)
        widgetIds.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_stats)
            bindStats(context, views, data)
            manager.updateAppWidget(id, views)
        }
    }

    private fun bindStats(context: Context, views: RemoteViews, data: StatsWidgetData) {
        views.setTextViewText(R.id.widget_stats_month, data.monthLabel())
        val hasData = data.updatedAt > 0 && (data.income > 0 || data.expense > 0)
        val incomeText = formatAmount(data.income, hasData)
        val expenseText = formatAmount(data.expense, hasData)
        val netText = formatNet(data.income - data.expense, hasData)

        views.setTextViewText(
            R.id.widget_stats_income_value,
            context.getString(R.string.widget_stats_income_value, incomeText)
        )
        views.setTextViewText(
            R.id.widget_stats_expense_value,
            context.getString(R.string.widget_stats_expense_value, expenseText)
        )
        views.setTextViewText(
            R.id.widget_stats_net_value,
            context.getString(R.string.widget_stats_net_value, netText)
        )

        val maxExpense = max(1L, data.daily.maxOfOrNull { it.expense } ?: 1L)
        val lastSeven = data.daily.takeLast(7)
        for (index in 0 until 7) {
            val entry = lastSeven.getOrNull(index)
            val barId = context.resources.getIdentifier("widget_stats_bar_${index + 1}", "id", context.packageName)
            val labelId = context.resources.getIdentifier("widget_stats_bar_label_${index + 1}", "id", context.packageName)
            if (barId == 0 || labelId == 0) continue
            if (entry == null) {
                views.setProgressBar(barId, PROGRESS_MAX, 0, false)
                views.setTextColor(labelId, Color.parseColor("#4B5563"))
                views.setTextViewText(labelId, "")
            } else {
                val progress = ((entry.expense.toDouble() / maxExpense.toDouble()) * PROGRESS_MAX)
                    .roundToInt()
                    .coerceIn(0, PROGRESS_MAX)
                views.setProgressBar(barId, PROGRESS_MAX, progress, false)
                val date = runCatching { LocalDate.parse(entry.dateIso) }.getOrElse {
                    LocalDate.now(JAKARTA_ZONE)
                }
                val label = date.format(DateTimeFormatter.ofPattern("d/M"))
                views.setTextColor(labelId, Color.parseColor("#9CA3AF"))
                views.setTextViewText(labelId, label)
            }
        }

        val intent = createDeepLink(context, "reports", REQUEST_STATS)
        views.setOnClickPendingIntent(R.id.widget_stats_root, intent)
    }

    private fun selectSummaryLayout(manager: AppWidgetManager, appWidgetId: Int): Int {
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
