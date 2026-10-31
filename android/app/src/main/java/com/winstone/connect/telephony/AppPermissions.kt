package com.winstone.connect.telephony

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Which runtime permissions the app asks for automatically.
 *
 * Android never lets an app switch these on by itself — the agent must tap
 * "Allow" — so the app asks on every open for anything still missing, and
 * shows a Settings shortcut once Android stops showing the prompt.
 *
 * Phone/call-log access is always asked. Microphone and the phone's own
 * recorder files are asked ONLY after the signed-in agent's recording consent.
 */
object AppPermissions {
    /** Bumped on app resume and after a permission answer so status cards re-read access. */
    val changes = kotlinx.coroutines.flow.MutableStateFlow(0)
    fun bump() { changes.value = changes.value + 1 }

    data class Item(val permission: String, val labelBn: String, val audio: Boolean)

    /** Pure rule, unit-tested. */
    fun wanted(sdk: Int, consented: Boolean): List<Item> {
        val list = mutableListOf(
            Item(Manifest.permission.CALL_PHONE, "কল করা", false),
            Item(Manifest.permission.READ_PHONE_STATE, "ফোনের অবস্থা", false),
            Item(Manifest.permission.READ_CALL_LOG, "কল লগ", false),
        )
        if (sdk >= 28) list += Item(Manifest.permission.ANSWER_PHONE_CALLS, "কল ধরা/কাটা", false)
        if (sdk >= 33) list += Item(Manifest.permission.POST_NOTIFICATIONS, "নোটিফিকেশন", false)
        if (consented) {
            list += Item(Manifest.permission.RECORD_AUDIO, "মাইক্রোফোন (রেকর্ডিং)", true)
            list += if (sdk >= 33) Item(Manifest.permission.READ_MEDIA_AUDIO, "রেকর্ডিং ফাইল", true)
            else Item(Manifest.permission.READ_EXTERNAL_STORAGE, "রেকর্ডিং ফাইল", true)
        }
        return list
    }

    /** Pure rule, unit-tested: ask each missing permission at most once per app open. */
    fun toRequest(wanted: List<Item>, granted: Set<String>, alreadyAsked: Set<String>): List<String> =
        wanted.map { it.permission }.filter { it !in granted && it !in alreadyAsked }

    fun wantedNow(context: Context, employeeId: String?): List<Item> =
        wanted(Build.VERSION.SDK_INT, RecordingConsent.granted(context, employeeId))

    fun isGranted(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun grantedSet(context: Context, items: List<Item>): Set<String> =
        items.map { it.permission }.filter { isGranted(context, it) }.toSet()

    /** Opens this app's page in Android Settings so the agent can switch access on. */
    fun openAppSettings(activity: Activity) {
        runCatching {
            activity.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", activity.packageName, null))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }
}
