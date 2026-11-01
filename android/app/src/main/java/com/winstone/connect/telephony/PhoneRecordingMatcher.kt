package com.winstone.connect.telephony

/**
 * Pure matching rule for the phone's own call recorder (Samsung, Xiaomi, Realme,
 * Oppo, Vivo, Google Dialer...). Kept free of Android types so it is JVM-tested.
 *
 * A candidate file belongs to a call only when ALL hold:
 *  - it is audio saved in a call-recording folder, or its name carries the
 *    called number's last 7 digits;
 *  - it was written between call start - 15 s and call end + 3 min;
 *  - its own length (when the OS reports it) is not wildly off the call length.
 * Ambiguity is rejected, never guessed:
 *  - a file whose name carries a different Bangladeshi number is excluded;
 *  - exactly one file naming this call's number wins;
 *  - two or more files naming it, or (with no number in any name) two or more
 *    call-folder files in the window, = AMBIGUOUS → nothing uploaded.
 * No match = no upload.
 */
data class RecordingCandidate(
    val id: Long,
    val displayName: String,
    /** RELATIVE_PATH (Android 10+) or full DATA path on older phones. */
    val path: String,
    /** File timestamp (date added / modified) in millis. */
    val writtenAtMs: Long,
    /** Audio length in millis, 0 when unknown. */
    val durationMs: Long,
)

object PhoneRecordingMatcher {

    const val BEFORE_START_MS = 15_000L
    const val AFTER_END_MS = 180_000L

    private val FOLDER_HINTS = listOf(
        "call", "record", "রেকর্ড", "sound_recorder", "callrec", "phonerecord",
    )

    fun digitsTail(phone: String?): String? =
        phone?.filter { it.isDigit() }?.takeLast(7)?.takeIf { it.length == 7 }

    fun looksLikeCallRecording(c: RecordingCandidate, phoneTail: String?): Boolean {
        val p = c.path.lowercase()
        val n = c.displayName.lowercase()
        val folderHit = FOLDER_HINTS.any { p.contains(it) } && (p.contains("call") || n.contains("call") || phoneTail != null && n.filter { it.isDigit() }.contains(phoneTail))
        val numberHit = phoneTail != null && n.filter { it.isDigit() }.contains(phoneTail)
        return folderHit || numberHit
    }

    /** Bangladeshi mobile numbers inside a file name (01XXXXXXXXX, optional 880 prefix). */
    private val BD_NUMBER = Regex("(?:880)?01[3-9]\\d{8}")

    /** True when the name carries a phone number that is not this call's number. */
    fun namesAnotherNumber(c: RecordingCandidate, phoneTail: String?): Boolean {
        if (phoneTail == null) return false
        val numbers = BD_NUMBER.findAll(c.displayName.filter { it.isDigit() || it == ' ' || it == '_' || it == '-' }.replace(Regex("[ _-]"), "|"))
            .map { it.value }.toList()
        return numbers.isNotEmpty() && numbers.none { it.endsWith(phoneTail) }
    }

    private fun namesThisNumber(c: RecordingCandidate, phoneTail: String?): Boolean =
        phoneTail != null && c.displayName.filter { it.isDigit() }.contains(phoneTail)

    fun decide(
        candidates: List<RecordingCandidate>,
        callStartMs: Long,
        callEndMs: Long,
        phone: String?,
    ): MatchDecision {
        val tail = digitsTail(phone)
        val callMs = (callEndMs - callStartMs).coerceAtLeast(0)
        val eligible = candidates
            .filter { it.writtenAtMs in (callStartMs - BEFORE_START_MS)..(callEndMs + AFTER_END_MS) }
            .filter { looksLikeCallRecording(it, tail) }
            .filter { it.durationMs == 0L || callMs == 0L || it.durationMs <= callMs + 30_000L }
            .filterNot { namesAnotherNumber(it, tail) }
        val named = eligible.filter { namesThisNumber(it, tail) }
        return when {
            named.size == 1 -> MatchDecision(MatchOutcome.MATCHED, named.single())
            named.size > 1 -> MatchDecision(MatchOutcome.AMBIGUOUS, null)
            eligible.size == 1 -> MatchDecision(MatchOutcome.MATCHED, eligible.single())
            eligible.size > 1 -> MatchDecision(MatchOutcome.AMBIGUOUS, null)
            else -> MatchDecision(MatchOutcome.NONE, null)
        }
    }

    /** The single safe match, or null when there is none or it is ambiguous. */
    fun pick(
        candidates: List<RecordingCandidate>,
        callStartMs: Long,
        callEndMs: Long,
        phone: String?,
    ): RecordingCandidate? = decide(candidates, callStartMs, callEndMs, phone).candidate
}

enum class MatchOutcome { MATCHED, NONE, AMBIGUOUS }

data class MatchDecision(val outcome: MatchOutcome, val candidate: RecordingCandidate?)
