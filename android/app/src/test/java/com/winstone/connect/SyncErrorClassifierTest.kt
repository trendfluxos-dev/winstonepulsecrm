package com.winstone.connect

import com.winstone.connect.data.remote.SyncHttpException
import com.winstone.connect.data.sync.SyncErrorClassifier
import com.winstone.connect.data.sync.SyncErrorKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/** JVM tests: which sync failures retry, which stop, and what the agent is told. */
class SyncErrorClassifierTest {
    private fun http(code: Int, msg: String = "x") = SyncErrorClassifier.classify(SyncHttpException(code, msg))

    @Test fun networkAndServerSideFailuresRetry() {
        assertEquals(SyncErrorKind.NETWORK, SyncErrorClassifier.classify(IOException("timeout")).kind)
        for (code in listOf(408, 429, 500, 502, 503)) assertTrue("$code", http(code).retryable)
        assertEquals(SyncErrorKind.SERVER_BUSY, http(429).kind)
        assertEquals(SyncErrorKind.SERVER_ERROR, http(503).kind)
    }

    @Test fun badDataOwnershipConflictAndRetiredAppArePermanent() {
        assertEquals(SyncErrorKind.INVALID_DATA, http(400, "Invalid payload").kind)
        assertEquals(SyncErrorKind.ACCESS_DENIED, http(403, "এই লিড আপনার তালিকায় নেই").kind)
        assertEquals(SyncErrorKind.NOT_FOUND, http(404, "Unknown lead").kind)
        assertEquals(SyncErrorKind.CONFLICT, http(409, "call_uid belongs to another agent").kind)
        assertEquals(SyncErrorKind.APP_UPDATE_REQUIRED, http(410).kind)
        for (code in listOf(400, 403, 404, 409, 410, 413, 422)) assertFalse("$code", http(code).retryable)
    }

    @Test fun signInAndBriefingWaitForTheAgentAndKeepRetrying() {
        val signIn = http(401, "Unauthorized")
        assertEquals(SyncErrorKind.SIGN_IN_REQUIRED, signIn.kind)
        val briefing = http(409, "সকাল ৯:০৫-এর দৈনিক ব্রিফিং স্বীকার করুন")
        assertEquals(SyncErrorKind.BRIEFING_REQUIRED, briefing.kind)
        assertTrue(SyncErrorClassifier.shouldRetry(signIn, auditTrail = false, attempt = 50))
        assertTrue(SyncErrorClassifier.shouldRetry(briefing, auditTrail = false, attempt = 50))
    }

    @Test fun retryCeilingAppliesOnlyToNonAuditTransientItems() {
        val net = SyncErrorClassifier.of(SyncErrorKind.NETWORK)
        assertTrue(SyncErrorClassifier.shouldRetry(net, auditTrail = false, attempt = 11))
        assertFalse(SyncErrorClassifier.shouldRetry(net, auditTrail = false, attempt = 12))
        assertTrue(SyncErrorClassifier.shouldRetry(net, auditTrail = true, attempt = 500))
        assertFalse(SyncErrorClassifier.shouldRetry(http(403), auditTrail = true, attempt = 0))
    }

    @Test fun agentMessagesSayWhatToDoInBothLanguages() {
        assertTrue(http(401).agentMessage.contains("Sign in again"))
        assertTrue(http(403).agentMessage.contains("contact LeadHub/IT"))
        assertTrue(http(410).agentMessage.contains("Update the app"))
        assertTrue(SyncErrorClassifier.classify(IOException()).agentMessage.contains("ইন্টারনেট নেই"))
        for (kind in SyncErrorKind.values()) assertTrue(kind.name, SyncErrorClassifier.of(kind).agentMessage.length <= 220)
    }
}
