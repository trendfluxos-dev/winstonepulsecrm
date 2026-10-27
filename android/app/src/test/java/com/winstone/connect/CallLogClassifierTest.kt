package com.winstone.connect

import android.provider.CallLog
import com.winstone.connect.telephony.CallLogClassifier
import org.junit.Assert.assertEquals
import org.junit.Test

class CallLogClassifierTest {
    @Test fun outgoingConnectedIsCompleted() {
        val r = CallLogClassifier.classify(CallLog.Calls.OUTGOING_TYPE, 42)
        assertEquals("outgoing", r.direction); assertEquals("completed", r.state)
    }

    @Test fun outgoingZeroDurationIsNoAnswer() {
        assertEquals("no_answer", CallLogClassifier.classify(CallLog.Calls.OUTGOING_TYPE, 0).state)
    }

    @Test fun incomingAnsweredIsCompleted() {
        val r = CallLogClassifier.classify(CallLog.Calls.INCOMING_TYPE, 10)
        assertEquals("incoming", r.direction); assertEquals("completed", r.state)
    }

    @Test fun missedIsIncomingNoAnswer() {
        val r = CallLogClassifier.classify(CallLog.Calls.MISSED_TYPE, 0)
        assertEquals("incoming", r.direction); assertEquals("no_answer", r.state); assertEquals("missed", r.kind)
    }

    @Test fun rejectedAndBlockedStayDistinct() {
        assertEquals("rejected", CallLogClassifier.classify(CallLog.Calls.REJECTED_TYPE, 0).kind)
        assertEquals("blocked", CallLogClassifier.classify(CallLog.Calls.BLOCKED_TYPE, 0).kind)
    }
}
