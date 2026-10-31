package com.winstone.connect

import com.winstone.connect.telephony.RecordingConsent
import com.winstone.connect.telephony.RecordingConsent.Decision
import org.junit.Assert.assertEquals
import org.junit.Test

class RecordingConsentTest {
    @Test fun noStoredChoiceAsksForConsent() {
        assertEquals(Decision.NONE, RecordingConsent.decisionFor(null, 0, null, "E1"))
    }

    @Test fun sameAgentCurrentVersionGrantedCounts() {
        assertEquals(Decision.GRANTED, RecordingConsent.decisionFor("E1", RecordingConsent.VERSION, "granted", "E1"))
    }

    @Test fun anotherAgentsConsentNeverCarriesOver() {
        assertEquals(Decision.NONE, RecordingConsent.decisionFor("E1", RecordingConsent.VERSION, "granted", "E2"))
    }

    @Test fun olderConsentTextMustBeAcceptedAgain() {
        assertEquals(Decision.NONE, RecordingConsent.decisionFor("E1", RecordingConsent.VERSION - 1, "granted", "E1"))
    }

    @Test fun declineIsRemembered() {
        assertEquals(Decision.DECLINED, RecordingConsent.decisionFor("E1", RecordingConsent.VERSION, "declined", "E1"))
    }

    @Test fun signedOutNeverCountsAsConsent() {
        assertEquals(Decision.NONE, RecordingConsent.decisionFor("E1", RecordingConsent.VERSION, "granted", null))
    }
}
