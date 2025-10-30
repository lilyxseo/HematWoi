package com.hematwoi.dev.widget

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Currency
import java.util.Locale
import kotlin.math.abs

object MoneyFormatter {
    private val localeId = Locale("id", "ID")
    private val decimalSymbols = DecimalFormatSymbols(localeId).apply {
        decimalSeparator = ','
        groupingSeparator = '.'
    }
    private val wholeNumberFormat = DecimalFormat("#,###", decimalSymbols)
    private val oneDecimalFormat = DecimalFormat("0.#", decimalSymbols)

    fun format(amount: Long, currencyCode: String, showPlusForPositive: Boolean = false): String {
        val sign = when {
            amount < 0 -> "-"
            showPlusForPositive && amount > 0 -> "+"
            else -> ""
        }
        val absolute = abs(amount)
        val short = formatShortValue(absolute)
        return sign + currencySymbol(currencyCode) + short
    }

    private fun formatShortValue(value: Long): String {
        return when {
            value >= 1_000_000_000_000L -> formatWithSuffix(value, 1_000_000_000_000L, "T")
            value >= 1_000_000_000L -> formatWithSuffix(value, 1_000_000_000L, "M")
            value >= 1_000_000L -> formatWithSuffix(value, 1_000_000L, "jt")
            value >= 1_000L -> formatWithSuffix(value, 1_000L, "rb")
            else -> wholeNumberFormat.format(value)
        }
    }

    private fun formatWithSuffix(value: Long, divisor: Long, suffix: String): String {
        val scaled = value.toDouble() / divisor.toDouble()
        val formatted = oneDecimalFormat.format(scaled)
        return if (formatted.endsWith(",0")) {
            formatted.dropLast(2) + suffix
        } else {
            formatted + suffix
        }
    }

    private fun currencySymbol(currencyCode: String): String {
        return try {
            val currency = Currency.getInstance(currencyCode.uppercase(Locale.US))
            val symbol = currency.getSymbol(localeId)
            if (symbol.isBlank() || symbol == currency.currencyCode) {
                currency.currencyCode + " "
            } else {
                symbol
            }
        } catch (error: IllegalArgumentException) {
            currencyCode.uppercase(Locale.US) + " "
        }
    }
}
