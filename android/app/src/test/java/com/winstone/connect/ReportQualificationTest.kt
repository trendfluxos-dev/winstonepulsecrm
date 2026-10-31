package com.winstone.connect

import com.winstone.connect.data.LeadEvaluation
import com.winstone.connect.data.ShortRejectionReport
import org.junit.Assert.*
import org.junit.Test

class ReportQualificationTest {
    @Test fun everyMissingAnswerIsIncomplete() {
        val all = LeadEvaluation.questions.associate { it.key to false }
        LeadEvaluation.questions.forEach { assertFalse(LeadEvaluation.isComplete(all - it.key)) }
    }
    @Test fun allYesIsNinetyHot() {
        val all = LeadEvaluation.questions.associate { it.key to true }
        assertEquals(90, LeadEvaluation.score(all))
        assertEquals("hot", LeadEvaluation.category(LeadEvaluation.score(all)))
    }
    @Test fun rejectionIsDispositionOnly() {
        listOf("not_interested", "wrong_number", "fake").forEach {
            assertNotNull(ShortRejectionReport.forCategory(it))
        }
        listOf("callback", "no_answer", "busy", "failed", "interested").forEach {
            assertNull(ShortRejectionReport.forCategory(it))
        }
    }
}