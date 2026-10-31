package com.winstone.connect.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// সাদা কর্পোরেট ব্র্যান্ড রং — ওয়েব CRM-এর আইভরি/সাদা/চারকোল/শ্যাম্পেন প্যালেটের সাথে এক।
// পুরনো নামগুলো রাখা হয়েছে (WinGreen = সোনালি অ্যাকসেন্ট), শুধু মান বদলেছে।
val WinGreen = Color(0xFF8F6B2E) // champagne gold, deepened for text on white
val WinGreenSoft = Color(0xFFF6EFE0)
val WinCream = Color(0xFFFFFFFF)
val WinCreamDeep = Color(0xFFF5F2EA)
val WinBorder = Color(0xFFDED8CC)
val WinInk = Color(0xFF171717)
val WinInkMuted = Color(0xFF77736C)
val WinAmber = Color(0xFFB7791F)
val WinRed = Color(0xFFC2412D)
val WinLive = Color(0xFF2E9E63)
val WinSurface = Color(0xFFFFFFFF)

/** Primary buttons: charcoal with white text. */
val WinCharcoal = Color(0xFF171717)
val WinOnCharcoal = Color(0xFFFFFFFF)

private val WinstoneLight = lightColorScheme(
    primary = WinCharcoal,
    onPrimary = WinOnCharcoal,
    primaryContainer = WinGreenSoft,
    onPrimaryContainer = WinGreen,
    secondary = WinGreen,
    onSecondary = WinOnCharcoal,
    tertiary = WinAmber,
    background = WinCream,
    onBackground = WinInk,
    surface = WinSurface,
    onSurface = WinInk,
    surfaceVariant = WinCreamDeep,
    onSurfaceVariant = WinInkMuted,
    surfaceContainer = WinCreamDeep,
    surfaceContainerLow = WinSurface,
    surfaceContainerHigh = WinCreamDeep,
    outline = WinBorder,
    outlineVariant = WinBorder,
    error = WinRed,
    onError = WinOnCharcoal,
)

@Composable
fun WinstoneTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = WinstoneLight, content = content)
}
