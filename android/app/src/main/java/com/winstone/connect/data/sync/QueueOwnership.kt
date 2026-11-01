package com.winstone.connect.data.sync

import java.util.UUID

/**
 * Decides whether a queued sync job may be sent by the account that is
 * signed in right now. Pure so it is unit-tested without WorkManager.
 *
 * - SEND: the job belongs to the current agent (or is a legacy job queued
 *   before ownership stamping existed) and a token is present.
 * - HOLD: nobody is signed in / no token yet — keep the job until the same
 *   agent signs back in.
 * - DROP: a different agent is signed in — never post this job with their
 *   token. Local files are not deleted by a dropped job.
 */
object QueueOwnership {
    enum class Decision { SEND, HOLD, DROP }

    fun decide(owner: String?, current: String?, token: String?): Decision {
        if (current.isNullOrBlank() || token.isNullOrBlank()) return Decision.HOLD
        if (owner.isNullOrBlank()) return Decision.SEND
        return if (owner.trim().equals(current.trim(), ignoreCase = true)) Decision.SEND else Decision.DROP
    }

    /**
     * Recordings are stricter: audio must stay bound to the agent who made the
     * call and to that call's id. A recording with no owner or no call id is
     * never sent (it could be attached to the wrong agent or call); a different
     * signed-in agent drops it; nobody signed in holds it.
     */
    fun decideRecording(owner: String?, current: String?, token: String?, callUid: String?): Decision {
        if (owner.isNullOrBlank() || callUid.isNullOrBlank()) return Decision.DROP
        return decide(owner, current, token)
    }
}

/** One stable call_uid per call/outcome, reused across every retry. */
object OutcomeCallUid {
    private val SAFE = Regex("^[A-Za-z0-9._:-]{8,80}$")

    fun resolve(existing: String?): String {
        val clean = existing?.trim()
        return if (clean != null && SAFE.matches(clean)) clean else "out-" + UUID.randomUUID().toString()
    }
}
