package com.winstone.connect

import com.winstone.connect.telephony.CallHistoryEvidence
import com.winstone.connect.telephony.CallHistoryEvidence.TYPE_INCOMING
import com.winstone.connect.telephony.CallHistoryEvidence.TYPE_MISSED
import com.winstone.connect.telephony.CallHistoryEvidence.TYPE_OUTGOING
import com.winstone.connect.telephony.CallHistoryEvidence.TYPE_REJECTED
import com.winstone.connect.telephony.CallHistoryRow
import com.winstone.connect.telephony.CallState
import com.winstone.connect.telephony.CallVerdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM tests: answer and talk time come only from the phone's call history. */
class CallHistoryEvidenceTest {
    private val start = 1_800_000_000_000L          // OFFHOOK (dialling started)
    private val end = start + 75_000L               // IDLE: 75 s dial-to-hang-up
    private val window = 75
    private val phone = "+8801711223344"

    private fun row(type: Int, dur: Int, at: Long = start + 400, number: String = "01711223344") =
        CallHistoryRow(type, at, dur, number)

    private fun outcomeFor(rows: List<CallHistoryRow>, outgoing: Boolean = true) =
        CallHistoryEvidence.resolve(CallHistoryEvidence.pick(rows, phone, start, end, outgoing), window)

    @Test fun answeredOutgoingUsesCallLogTalkTimeNotDialWindow() {
        val o = outcomeFor(listOf(row(TYPE_OUTGOING, 48)))
        assertEquals(CallVerdict.ANSWERED, o.verdict)
        assertEquals(CallState.COMPLETED, o.state)
        assertEquals("completed", o.state.wire)
        assertEquals(48, o.talkSeconds) // not 75 (ringing included)
        assertTrue(o.connected)
    }

    @Test fun unansweredOutgoingAfterLongRingIsNotConnected() {
        val o = outcomeFor(listOf(row(TYPE_OUTGOING, 0)))
        assertEquals(CallVerdict.UNANSWERED, o.verdict)
        assertEquals("no_answer", o.state.wire)
        assertEquals(0, o.talkSeconds)
        assertFalse(o.connected)
    }

    @Test fun missedAndRejectedIncomingAreNeverConnected() {
        for (type in listOf(TYPE_MISSED, TYPE_REJECTED)) {
            val o = outcomeFor(listOf(row(type, 0)), outgoing = false)
            assertEquals(CallVerdict.MISSED, o.verdict)
            assertEquals("no_answer", o.state.wire)
            assertFalse(o.connected)
        }
    }

    @Test fun incomingTypeIsAnsweredEvenAtZeroSecondsWithNoTalkTime() {
        val zero = outcomeFor(listOf(row(TYPE_INCOMING, 0)), outgoing = false)
        assertEquals(CallVerdict.ANSWERED, zero.verdict)
        assertEquals("completed", zero.state.wire)
        assertEquals(0, zero.talkSeconds)
        val talked = outcomeFor(listOf(row(TYPE_INCOMING, 25)), outgoing = false)
        assertEquals(CallVerdict.ANSWERED, talked.verdict)
        assertEquals(25, talked.talkSeconds)
    }

    @Test fun outgoingZeroSecondsStaysUnanswered() {
        val o = outcomeFor(listOf(row(CallHistoryEvidence.TYPE_OUTGOING, 0)), outgoing = true)
        assertEquals(CallVerdict.UNANSWERED, o.verdict)
        assertFalse(o.connected)
    }

    @Test fun unavailableCallHistoryNeverClaimsAnswer() {
        val none = CallHistoryEvidence.resolve(null, window) // permission denied or no row
        assertEquals(CallVerdict.UNAVAILABLE, none.verdict)
        assertEquals("failed", none.state.wire)
        assertEquals(0, none.talkSeconds)
        assertFalse(none.connected)
        assertEquals("Call history unavailable — answer and talk time not verified", CallHistoryEvidence.note(none))
    }

    @Test fun otherNumberOrOutsideWindowIsNotMatched() {
        assertNull(CallHistoryEvidence.pick(listOf(row(TYPE_OUTGOING, 30, number = "01899999999")), phone, start, end, true))
        assertNull(CallHistoryEvidence.pick(listOf(row(TYPE_OUTGOING, 30, at = start - 5 * 60_000)), phone, start, end, true))
        assertNull(CallHistoryEvidence.pick(listOf(row(TYPE_INCOMING, 30)), phone, start, end, true))
        assertNull(CallHistoryEvidence.pick(listOf(row(TYPE_OUTGOING, 30)), "", start, end, true))
    }

    @Test fun talkTimeLongerThanTheObservedCallIsInconsistent() {
        val o = outcomeFor(listOf(row(TYPE_OUTGOING, window + 60)))
        assertEquals(CallVerdict.UNAVAILABLE, o.verdict)
        assertFalse(o.connected)
    }

    @Test fun picksTheRowClosestToDialTime() {
        val hit = CallHistoryEvidence.pick(
            listOf(row(TYPE_OUTGOING, 0, at = start - 20_000), row(TYPE_OUTGOING, 40, at = start + 300)),
            phone, start, end, true,
        )
        assertEquals(40, hit?.durationSeconds)
    }
}
