package com.hematwoi.dev.widget

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs

object MoneyFormatter {
    private val localeId = Locale("id", "ID")
    private val decimalSymbols: DecimalFormatSymbols = DecimalFormatSymbols(localeId).apply {
        decimalSeparator = ','
        groupingSeparator = '.'
    }
    private val wholeNumberFormat = DecimalFormat("#,###", decimalSymbols)
    private val oneDecimalFormat = DecimalFormat("0.#", decimalSymbols)

    fun formatIDShort(value: Long): String {
        return formatIDShort(value.toDouble())
    }

    fun formatIDShort(value: Double): String {
        if (value.isNaN() || value.isInfinite()) {
            return "0"
        }
        val sign = when {
            value < 0 -> "-"
            else -> ""
        }
        val absolute = abs(value)
        val (scaled, suffix) = when {
            absolute >= 1_000_000_000_000.0 -> absolute / 1_000_000_000_000.0 to "T"
            absolute >= 1_000_000_000.0 -> absolute / 1_000_000_000.0 to "M"
            absolute >= 1_000_000.0 -> absolute / 1_000_000.0 to "jt"
            absolute >= 1_000.0 -> absolute / 1_000.0 to "rb"
            else -> absolute to ""
        }
        val rawFormatted = if (suffix.isEmpty()) {
            wholeNumberFormat.format(scaled)
        } else {
            oneDecimalFormat.format(scaled)
        }
        val normalized = if (rawFormatted.endsWith(",0")) {
            rawFormatted.dropLast(2)
        } else {
            rawFormatted
        }
        val base = normalized + suffix
        return if (sign.isEmpty() || base == "0") base else sign + base
    }
}
