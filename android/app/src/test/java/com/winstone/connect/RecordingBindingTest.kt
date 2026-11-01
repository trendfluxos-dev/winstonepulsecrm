package com.winstone.connect

import com.winstone.connect.data.sync.QueueOwnership
import com.winstone.connect.data.sync.QueueOwnership.Decision
import org.junit.Assert.assertEquals
import org.junit.Test

/** JVM tests: a queued recording is sent only for the agent and call it was recorded on. */
class RecordingBindingTest {
    private val call = "and-abc123-1800000000000"

    @Test fun sameAgentWithCallIdIsSent() {
        assertEquals(Decision.SEND, QueueOwnership.decideRecording("W-101", "W-101", "tok", call))
        assertEquals(Decision.SEND, QueueOwnership.decideRecording("w-101", " W-101 ", "tok", call))
    }

    @Test fun anotherSignedInAgentNeverSendsIt() {
        assertEquals(Decision.DROP, QueueOwnership.decideRecording("W-101", "W-202", "tok", call))
    }

    @Test fun recordingWithoutOwnerOrCallIdIsNeverSent() {
        assertEquals(Decision.DROP, QueueOwnership.decideRecording(null, "W-101", "tok", call))
        assertEquals(Decision.DROP, QueueOwnership.decideRecording("", "W-101", "tok", call))
        assertEquals(Decision.DROP, QueueOwnership.decideRecording("W-101", "W-101", "tok", null))
        assertEquals(Decision.DROP, QueueOwnership.decideRecording("W-101", "W-101", "tok", " "))
    }

    @Test fun signedOutHoldsUntilTheSameAgentReturns() {
        assertEquals(Decision.HOLD, QueueOwnership.decideRecording("W-101", null, null, call))
        assertEquals(Decision.HOLD, QueueOwnership.decideRecording("W-101", "W-101", null, call))
    }

    @Test fun otherQueuedWorkKeepsTheLegacyRule() {
        assertEquals(Decision.SEND, QueueOwnership.decide(null, "W-101", "tok"))
    }
}
