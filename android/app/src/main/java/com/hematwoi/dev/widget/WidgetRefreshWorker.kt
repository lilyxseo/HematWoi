package com.hematwoi.dev.widget

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class WidgetRefreshWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        WidgetUpdater.updateAll(applicationContext)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "summary_widget_refresh"
        private const val INTERVAL_HOURS = 3L
        private const val FLEX_MINUTES = 30L

        fun schedule(context: Context) {
            val workManager = WorkManager.getInstance(context)
            val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(
                INTERVAL_HOURS, TimeUnit.HOURS,
                FLEX_MINUTES, TimeUnit.MINUTES
            ).build()
            workManager.enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
