package com.winstone.connect

import com.winstone.connect.data.sync.SyncFailureLog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM tests: the phone's local failure log merges retries and never grows without bound. */
class SyncFailureLogTest {
    private var n = 0
    private val id = { "id-${n++}" }

    @Test fun repeatedRetriesOfTheSameProblemBecomeOneEntry() {
        var log = SyncFailureLog.merge(emptyMap(), "recording", "NETWORK", null, 1, false, "a1b2c3d4e5f6", "2026-11-01T06:00:00.000Z", id)
        log = SyncFailureLog.merge(log, "recording", "NETWORK", null, 2, false, "a1b2c3d4e5f6", "2026-11-01T06:05:00.000Z", id)
        log = SyncFailureLog.merge(log, "recording", "NETWORK", null, 3, false, "a1b2c3d4e5f6", "2026-11-01T06:10:00.000Z", id)
        assertEquals(1, log.size)
        val e = log.values.single()
        assertEquals(3, e.count); assertEquals(3, e.attempts)
        assertEquals("2026-11-01T06:00:00.000Z", e.firstAt); assertEquals("2026-11-01T06:10:00.000Z", e.lastAt)
    }

    @Test fun differentErrorOrCallIsASeparateEntry() {
        var log = SyncFailureLog.merge(emptyMap(), "recording", "NETWORK", null, 1, false, "a1b2c3d4e5f6", "t1", id)
        log = SyncFailureLog.merge(log, "recording", "ACCESS_DENIED", 403, 1, true, "a1b2c3d4e5f6", "t2", id)
        log = SyncFailureLog.merge(log, "recording", "NETWORK", null, 1, false, "ffffffffffff", "t3", id)
        assertEquals(3, log.size)
    }

    @Test fun logIsCappedDroppingTheOldest() {
        var log = emptyMap<String, com.winstone.connect.data.sync.SyncFailureEntry>()
        for (i in 0 until SyncFailureLog.MAX_ENTRIES + 5) {
            log = SyncFailureLog.merge(log, "call_state", "SERVER_ERROR", 503, 1, false, "%012x".format(i), "2026-11-01T06:%02d:00.000Z".format(i), id)
        }
        assertEquals(SyncFailureLog.MAX_ENTRIES, log.size)
        assertTrue(log.values.none { it.callRef == "%012x".format(0) })
    }

    @Test fun acknowledgedEntriesAreRemovedButLaterFailuresAreKept() {
        var log = SyncFailureLog.merge(emptyMap(), "recording", "NETWORK", null, 1, false, "a1b2c3d4e5f6", "t1", id)
        val sent = log.values.toList()
        assertTrue(SyncFailureLog.acknowledge(log, sent).isEmpty())
        // A retry failed again while the batch was in flight: only the new part remains.
        log = SyncFailureLog.merge(log, "recording", "NETWORK", null, 2, false, "a1b2c3d4e5f6", "t2", id)
        val left = SyncFailureLog.acknowledge(log, sent)
        assertEquals(1, left.values.single().count)
    }

    @Test fun unknownItemKindsAreLabelledOther() {
        assertEquals("other", SyncFailureLog.itemKind("anything"))
        assertEquals("recording", SyncFailureLog.itemKind("recording"))
    }
}
