package com.winstone.connect.data.sync

/**
 * Offline sync-failure drill (sandbox test mode). Replays a scripted CRM reply
 * sequence through the SAME rules the live queue uses — [SyncErrorClassifier],
 * [SyncErrorClassifier.shouldRetry] and [SyncFailureLog.merge] — against an
 * in-memory stand-in for the CRM's once-only history ledger. Nothing touches the
 * network or the live database: results are synthetic and liveWrites is always 0.
 */
object SyncFailureDrill {
    /** One scripted CRM reply. ACK_LOST = the CRM saved it but the reply never arrived. */
    sealed class Reply(val label: String) {
        data class Http(val code: Int) : Reply("http")
        object Offline : Reply("offline")
        object Ok : Reply("ok")
        object AckLost : Reply("ack_lost")
    }

    enum class Scenario(val wire: String, val expectRetryable: Boolean, val replies: List<Reply>) {
        SERVER_ERROR_THEN_OK("server_error_then_ok", true, listOf(Reply.Http(500), Reply.Http(503), Reply.Ok)),
        OFFLINE_THEN_OK("offline_then_ok", true, listOf(Reply.Offline, Reply.Offline, Reply.Ok)),
        RATE_LIMITED_THEN_OK("rate_limited_then_ok", true, listOf(Reply.Http(429), Reply.Ok)),
        LOST_ACK_THEN_RETRY("lost_ack_then_retry", true, listOf(Reply.AckLost, Reply.Ok)),
        SIGN_IN_EXPIRED_THEN_OK("sign_in_expired_then_ok", true, listOf(Reply.Http(401), Reply.Ok)),
        LEAD_NOT_ASSIGNED("lead_not_assigned", false, listOf(Reply.Http(403))),
        DATA_REJECTED("data_rejected", false, listOf(Reply.Http(422))),
        CALL_CONFLICT("call_conflict", false, listOf(Reply.Http(409))),
        APP_UPDATE_REQUIRED("app_update_required", false, listOf(Reply.Http(426))),
    }

    data class Attempt(
        val attempt: Int,
        val reply: String,
        val http: Int?,
        val kind: String?,
        val retryable: Boolean?,
        val decision: String, // retry | stop | sent
        val agentMessage: String?,
    )

    data class Result(
        val scenario: String,
        val expectRetryable: Boolean,
        val final: String, // sent | failed_permanent | gave_up
        val attempts: List<Attempt>,
        val historyEntries: Int,
        val failureLogEntries: Int,
    )

    const val CALL_UID = "sandbox-drill-call"

    fun run(scenario: Scenario, nowIso: String = "1970-01-01T00:00:00Z"): Result {
        val ledger = HashSet<String>() // CRM once-only history: key -> one entry
        val onceKey = "lead_event:$CALL_UID:call_started"
        var log: Map<String, SyncFailureEntry> = emptyMap()
        val attempts = ArrayList<Attempt>()
        var final = "gave_up"
        var counter = 0
        for ((index, reply) in scenario.replies.withIndex()) {
            val attempt = index + 1
            when (reply) {
                Reply.Ok -> {
                    ledger.add(onceKey) // idempotent: a second write of the same key adds nothing
                    attempts += Attempt(attempt, reply.label, 200, null, null, "sent", null)
                    final = "sent"
                }
                else -> {
                    if (reply == Reply.AckLost) ledger.add(onceKey)
                    val failure = when (reply) {
                        is Reply.Http -> SyncErrorClassifier.classify(reply.code, "")
                        Reply.Offline -> SyncErrorClassifier.of(SyncErrorKind.NETWORK)
                        else -> SyncErrorClassifier.of(SyncErrorKind.SERVER_ERROR) // ack lost reads as a server/network error
                    }
                    val http = when (reply) { is Reply.Http -> reply.code; Reply.AckLost -> 503; else -> 0 }
                    val retry = SyncErrorClassifier.shouldRetry(failure, auditTrail = true, attempt = attempt)
                    log = SyncFailureLog.merge(log, "call_state", failure.kind.name.lowercase(), http, attempt, !failure.retryable,
                        SyncDiagnostics.fingerprint(CALL_UID), nowIso) { "drill-${counter++}" }
                    attempts += Attempt(attempt, reply.label, http, failure.kind.name.lowercase(), failure.retryable,
                        if (retry) "retry" else "stop", failure.agentMessage)
                    if (!retry) { final = "failed_permanent"; break }
                }
            }
            if (final == "sent") break
        }
        return Result(scenario.wire, scenario.expectRetryable, final, attempts, ledger.size, log.size)
    }

    fun runAll(nowIso: String = "1970-01-01T00:00:00Z"): List<Result> = Scenario.values().map { run(it, nowIso) }
}
