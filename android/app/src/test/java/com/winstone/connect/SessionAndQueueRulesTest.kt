package com.winstone.connect

import com.winstone.connect.data.SessionRules
import com.winstone.connect.data.sync.OutcomeCallUid
import com.winstone.connect.data.sync.QueueOwnership
import com.winstone.connect.data.sync.QueueOwnership.Decision
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionAndQueueRulesTest {
    private val token = "t".repeat(40)

    @Test fun signedInNeedsIdentityAndToken() {
        assertTrue(SessionRules.isSignedIn("WIN-1", token))
        assertFalse(SessionRules.isSignedIn("WIN-1", null))
        assertFalse(SessionRules.isSignedIn("WIN-1", "short"))
        assertFalse(SessionRules.isSignedIn(null, token))
    }

    @Test fun queuedWorkNeverCrossesAccounts() {
        assertEquals(Decision.SEND, QueueOwnership.decide("WIN-1", "win-1", token))
        assertEquals(Decision.DROP, QueueOwnership.decide("WIN-1", "WIN-2", token))
        assertEquals(Decision.HOLD, QueueOwnership.decide("WIN-1", null, null))
        assertEquals(Decision.HOLD, QueueOwnership.decide("WIN-1", "WIN-1", null))
        assertEquals(Decision.SEND, QueueOwnership.decide(null, "WIN-1", token)) // legacy job
    }

    @Test fun callUidIsStableAcrossRetries() {
        assertEquals("call-abc-12345", OutcomeCallUid.resolve("call-abc-12345"))
        val fresh = OutcomeCallUid.resolve(null)
        assertTrue(fresh.startsWith("out-"))
        assertNotEquals(fresh, OutcomeCallUid.resolve("bad uid!"))
    }
}
