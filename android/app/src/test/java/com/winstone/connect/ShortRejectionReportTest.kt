package com.winstone.connect

import com.winstone.connect.data.ShortRejectionReport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ShortRejectionReportTest {
    @Test fun notInterestedUsesCanonicalClosure() {
        assertEquals(ShortRejectionReport("Customer Not Interested", "not_interested"), ShortRejectionReport.forCategory("not_interested"))
    }
    @Test fun wrongNumberUsesCanonicalClosure() {
        assertEquals(ShortRejectionReport("Wrong Number", "wrong_number"), ShortRejectionReport.forCategory("wrong_number"))
    }
    @Test fun fakeRetainsExplicitEvidence() {
        assertEquals(ShortRejectionReport("Fake / Invalid contact", "other"), ShortRejectionReport.forCategory("fake"))
    }
    @Test fun normalOutcomesAreNotRejections() {
        listOf("interested", "hot_lead", "follow_up", "callback", "closed_converted", "no_answer", "").forEach {
            assertNull(ShortRejectionReport.forCategory(it))
        }
    }
}
class FakeNeedsAnsweredCallTest {
    @Test fun fakeOnUnansweredCallIsBlocked() {
        org.junit.Assert.assertTrue(ShortRejectionReport.fakeNeedsAnsweredCall("fake", received = false))
    }
    @Test fun fakeOnAnsweredCallIsAllowed() {
        org.junit.Assert.assertFalse(ShortRejectionReport.fakeNeedsAnsweredCall("fake", received = true))
    }
    @Test fun otherRejectionsUnaffected() {
        listOf("not_interested", "wrong_number", "no_answer").forEach {
            org.junit.Assert.assertFalse(ShortRejectionReport.fakeNeedsAnsweredCall(it, received = false))
        }
    }
}
