package com.winstone.connect.telephony

import kotlin.math.abs

/** One row of the phone's own call history (Android CallLog), already read from the content provider. */
data class CallHistoryRow(
    val type: Int,
    val dateMs: Long,
    val durationSeconds: Int,
    val number: String,
)

/** What the phone's call history proves about a finished call. */
enum class CallVerdict { ANSWERED, UNANSWERED, MISSED, UNAVAILABLE }

/**
 * The outcome sent to the CRM for a dialled call.
 * [state] is what the CRM is told; [talkSeconds] is Android's own CallLog.DURATION
 * (talk time after answer), never the dial-to-hang-up time measured by the receiver.
 */
data class CallOutcome(
    val verdict: CallVerdict,
    val state: CallState,
    val talkSeconds: Int,
    val evidenceDateMs: Long?,
) {
    /** Connected only when the call history shows real talk time. */
    val connected: Boolean get() = verdict == CallVerdict.ANSWERED
}

/**
 * Pure rules that turn the phone's call history into a verified call outcome.
 *
 * PHONE_STATE OFFHOOK for an outgoing call only means dialling started; Android
 * does not tell an app when the other side picks up. The call history row the
 * system writes after hang-up does: its DURATION is talk time, 0 when unanswered.
 * When no matching row can be read (permission denied, OEM delay, number hidden)
 * the outcome is UNAVAILABLE — never guessed as answered.
 */
object CallHistoryEvidence {
    // android.provider.CallLog.Calls TYPE values (kept literal so this stays JVM-testable).
    const val TYPE_INCOMING = 1
    const val TYPE_OUTGOING = 2
    const val TYPE_MISSED = 3
    const val TYPE_VOICEMAIL = 4
    const val TYPE_REJECTED = 5
    const val TYPE_BLOCKED = 6

    /** Call history DATE is the dial time; allow clock skew before OFFHOOK and a little after hang-up. */
    const val MATCH_BEFORE_MS = 30_000L
    const val MATCH_AFTER_MS = 5_000L

    /** Talk time may not exceed the observed call window by more than this. */
    const val DURATION_SLACK_SECONDS = 10

    private fun tail(number: String): String = number.filter(Char::isDigit).takeLast(10)

    /** The call-history row for this physical call, or null when none can be matched safely. */
    fun pick(
        rows: List<CallHistoryRow>,
        phone: String,
        startMs: Long,
        endMs: Long,
        outgoing: Boolean,
    ): CallHistoryRow? {
        if (startMs <= 0L || endMs < startMs) return null
        val want = tail(phone)
        if (want.length < 7) return null // no reliable number = no match, never "closest call"
        return rows
            .filter { r ->
                r.dateMs in (startMs - MATCH_BEFORE_MS)..(endMs + MATCH_AFTER_MS) &&
                    (if (outgoing) r.type == TYPE_OUTGOING else r.type != TYPE_OUTGOING) &&
                    tail(r.number) == want
            }
            .minByOrNull { abs(it.dateMs - startMs) }
    }

    /**
     * Turns the matched row into the CRM outcome.
     * [observedWindowSeconds] is dial-to-hang-up seen live; a longer talk time is
     * inconsistent evidence and is treated as unavailable.
     */
    fun resolve(row: CallHistoryRow?, observedWindowSeconds: Int): CallOutcome {
        if (row == null) return unavailable()
        val talk = row.durationSeconds.coerceAtLeast(0)
        if (talk > observedWindowSeconds.coerceAtLeast(0) + DURATION_SLACK_SECONDS) return unavailable()
        return when (row.type) {
            TYPE_OUTGOING ->
                if (talk > 0) CallOutcome(CallVerdict.ANSWERED, CallState.COMPLETED, talk, row.dateMs)
                else CallOutcome(CallVerdict.UNANSWERED, CallState.CANCELLED, 0, row.dateMs)
            // Answered incoming even at 0 s; 0 talk seconds never proves a connection server-side.
            TYPE_INCOMING ->
                if (row.durationSeconds >= 0) CallOutcome(CallVerdict.ANSWERED, CallState.COMPLETED, talk, row.dateMs)
                else unavailable()
            TYPE_MISSED, TYPE_REJECTED, TYPE_BLOCKED, TYPE_VOICEMAIL ->
                CallOutcome(CallVerdict.MISSED, CallState.MISSED, 0, row.dateMs)
            else -> unavailable()
        }
    }

    /**
     * Call history could not prove the result. The CRM is told "failed" (its only
     * terminal state that does not claim a conversation) so the mandatory report
     * still opens, as not connected; the agent can correct it in the report, and
     * that correction is never counted as phone-verified.
     */
    fun unavailable(): CallOutcome = CallOutcome(CallVerdict.UNAVAILABLE, CallState.FAILED, 0, null)

    /** Note stored with the call so staff see why the result is unverified. */
    fun note(outcome: CallOutcome): String? =
        if (outcome.verdict == CallVerdict.UNAVAILABLE) "Call history unavailable — answer and talk time not verified" else null
}
