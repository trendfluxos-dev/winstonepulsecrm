package com.winstone.connect.telephony

import android.content.Context

/**
 * Recording consent gate.
 *
 * No call audio is captured, picked up from the phone's own recorder or
 * uploaded until the signed-in agent has explicitly agreed to the current
 * consent text on THIS phone. Consent is tied to the employee id and the
 * consent version, so an account switch or a changed text asks again.
 * Declining never blocks calling, call logs or reports — only audio.
 *
 * The agent also agrees to tell every customer at the start of the call that
 * it may be recorded (shown again on the live call screen while recording).
 */
object RecordingConsent {
    /** Bump when the consent text changes so every agent re-confirms. */
    const val VERSION = 1

    const val CUSTOMER_NOTICE_BN = "\"এই কলটি সেবার মান নিশ্চিত করতে রেকর্ড করা হতে পারে।\""

    private const val PREFS = "winstone_recording_consent"
    private const val KEY_EMPLOYEE = "employee_id"
    private const val KEY_VERSION = "version"
    private const val KEY_DECISION = "decision"
    private const val KEY_AT = "decided_at"

    enum class Decision { NONE, GRANTED, DECLINED }

    /** Pure rule, unit-tested: consent only counts for the same agent and current version. */
    fun decisionFor(
        storedEmployee: String?,
        storedVersion: Int,
        storedDecision: String?,
        currentEmployee: String?,
        currentVersion: Int = VERSION,
    ): Decision {
        if (currentEmployee.isNullOrBlank()) return Decision.NONE
        if (storedEmployee != currentEmployee || storedVersion != currentVersion) return Decision.NONE
        return when (storedDecision) {
            "granted" -> Decision.GRANTED
            "declined" -> Decision.DECLINED
            else -> Decision.NONE
        }
    }

    fun decision(context: Context, employeeId: String?): Decision {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return decisionFor(
            p.getString(KEY_EMPLOYEE, null),
            p.getInt(KEY_VERSION, 0),
            p.getString(KEY_DECISION, null),
            employeeId,
        )
    }

    /** True only when this agent agreed to the current consent text on this phone. */
    fun granted(context: Context, employeeId: String?): Boolean =
        decision(context, employeeId) == Decision.GRANTED

    fun record(context: Context, employeeId: String, granted: Boolean) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_EMPLOYEE, employeeId)
            .putInt(KEY_VERSION, VERSION)
            .putString(KEY_DECISION, if (granted) "granted" else "declined")
            .putLong(KEY_AT, System.currentTimeMillis())
            .apply()
    }

    /** Lets the agent review the choice again (e.g. to withdraw consent). */
    fun reset(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
