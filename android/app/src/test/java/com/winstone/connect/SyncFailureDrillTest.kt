package com.winstone.connect

import com.winstone.connect.data.sync.SyncFailureDrill
import com.winstone.connect.data.sync.SyncFailureDrill.Scenario
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncFailureDrillTest {
    @Test fun retryableScenariosEndSentWithExactlyOneHistoryEntry() {
        for (s in Scenario.values().filter { it.expectRetryable }) {
            val r = SyncFailureDrill.run(s)
            assertEquals(s.wire, "sent", r.final)
            assertEquals(s.wire, 1, r.historyEntries)
            assertTrue(s.wire, r.attempts.dropLast(1).all { it.decision == "retry" && it.retryable == true })
        }
    }

    @Test fun lostAcknowledgementRetryDoesNotDuplicateHistory() {
        val r = SyncFailureDrill.run(Scenario.LOST_ACK_THEN_RETRY)
        assertEquals(2, r.attempts.size)
        assertEquals(1, r.historyEntries)
    }

    @Test fun permanentScenariosStopAfterOneAttemptWithNoHistory() {
        for (s in Scenario.values().filter { !it.expectRetryable }) {
            val r = SyncFailureDrill.run(s)
            assertEquals(s.wire, "failed_permanent", r.final)
            assertEquals(s.wire, 1, r.attempts.size)
            assertEquals(s.wire, false, r.attempts.single().retryable)
            assertEquals(s.wire, 0, r.historyEntries)
            assertTrue(s.wire, r.attempts.single().agentMessage!!.contains(" / "))
        }
    }

    @Test fun repeatedSameFailureIsOneLocalLogEntry() {
        val r = SyncFailureDrill.run(Scenario.OFFLINE_THEN_OK)
        assertEquals(1, r.failureLogEntries)
        assertEquals("network", r.attempts.first().kind)
        val mixed = SyncFailureDrill.run(Scenario.SERVER_ERROR_THEN_OK)
        assertEquals(1, mixed.failureLogEntries) // 500 and 503 are the same error kind
    }
}
