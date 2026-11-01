package com.winstone.connect.data.sync

import java.util.UUID

/**
 * Pure, JVM-tested merge rules for the phone's local sync-failure log.
 *
 * One entry per (item kind, error kind, call fingerprint): repeated retries of
 * the same problem bump `count`/`attempts`/`lastAt` instead of adding rows, so a
 * long offline spell becomes one report. Only technical fields are kept — no
 * phone numbers, names, message text or tokens.
 */
data class SyncFailureEntry(
    val id: String,
    val itemKind: String,
    val errorKind: String,
    val httpStatus: Int?,
    val attempts: Int,
    val count: Int,
    val permanent: Boolean,
    val callRef: String?,
    val firstAt: String,
    val lastAt: String,
)

object SyncFailureLog {
    const val MAX_ENTRIES = 50
    private val ITEM_KINDS = setOf(
        "recording", "call_state", "incoming_call", "report_open", "report_submit",
        "lead_submit", "outcome", "recording_pickup",
    )

    fun itemKind(kind: String?): String = if (kind != null && kind in ITEM_KINDS) kind else "other"

    fun key(itemKind: String, errorKind: String, callRef: String?) = "$itemKind|$errorKind|${callRef ?: "-"}"

    fun merge(
        log: Map<String, SyncFailureEntry>,
        itemKind: String,
        errorKind: String,
        httpStatus: Int?,
        attempt: Int,
        permanent: Boolean,
        callRef: String?,
        nowIso: String,
        newId: () -> String = { UUID.randomUUID().toString() },
    ): Map<String, SyncFailureEntry> {
        val k = key(itemKind, errorKind, callRef)
        val prior = log[k]
        val entry = if (prior == null) {
            SyncFailureEntry(newId(), itemKind, errorKind, httpStatus, attempt.coerceAtLeast(0), 1, permanent, callRef, nowIso, nowIso)
        } else {
            prior.copy(
                httpStatus = httpStatus ?: prior.httpStatus,
                attempts = maxOf(prior.attempts, attempt),
                count = (prior.count + 1).coerceAtMost(9999),
                permanent = prior.permanent || permanent,
                lastAt = nowIso,
            )
        }
        val next = LinkedHashMap(log)
        next.remove(k)
        next[k] = entry
        // Bounded: drop the entries that changed longest ago.
        while (next.size > MAX_ENTRIES) next.remove(next.entries.minByOrNull { it.value.lastAt }!!.key)
        return next
    }

    /** After a successful send, remove only entries unchanged since they were sent. */
    fun acknowledge(log: Map<String, SyncFailureEntry>, sent: Collection<SyncFailureEntry>): Map<String, SyncFailureEntry> {
        val sentById = sent.associateBy { it.id }
        return log.filterValues { e -> sentById[e.id]?.let { it.count != e.count || it.lastAt != e.lastAt } ?: true }
            .mapValues { (_, e) -> if (sentById.containsKey(e.id)) e.copy(id = UUID.randomUUID().toString(), count = e.count - sentById[e.id]!!.count) else e }
            .filterValues { it.count > 0 }
    }
}
