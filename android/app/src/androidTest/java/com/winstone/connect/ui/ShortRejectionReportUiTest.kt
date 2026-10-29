package com.winstone.connect.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.winstone.connect.BuildConfig
import com.winstone.connect.data.LeadEvaluation
import org.json.JSONObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Actual native form, synthetic pending call, offline sandbox. Never taps Submit. */
@RunWith(AndroidJUnit4::class)
class ShortRejectionReportUiTest {
    @get:Rule val compose = createComposeRule()

    @Before
    fun openSyntheticReport() {
        check(BuildConfig.BUILD_TYPE == "sandbox") { "UI tests require the offline sandbox" }
        compose.setContent {
            MaterialTheme {
                ReportSheet(
                    notes = "পরীক্ষার নোট",
                    loadPendingReport = {
                        JSONObject().put("pending", JSONObject()
                            .put("id", "synthetic-ui-report")
                            .put("duration_seconds", 3)
                            .put("connected", true))
                    },
                )
            }
        }
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText("কলের ধরন:", substring = true)
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun selectCategory(label: String) {
        compose.onNodeWithText(label, substring = true).performScrollTo().performClick()
    }

    private fun assertShortReport() {
        compose.onNodeWithText("লিড মূল্যায়ন — সব প্রশ্নের হ্যাঁ / না দিন").assertDoesNotExist()
        LeadEvaluation.questions.forEach { question ->
            compose.onNodeWithText(question.label, substring = true).assertDoesNotExist()
        }
        compose.onNodeWithText("Grade (বাধ্যতামূলক)").assertDoesNotExist()
        compose.onNodeWithText("কারণ (বাধ্যতামূলক)").assertDoesNotExist()
        compose.onNodeWithText("যোগাযোগ বন্ধের কারণ (বাধ্যতামূলক)").assertDoesNotExist()
        compose.onNodeWithText("ফলো-আপ তারিখ", substring = true).assertDoesNotExist()
        compose.onNodeWithText("সময় (14:30)", substring = true).assertDoesNotExist()
        // Three-second confirmed rejection needs no fabricated qualification facts.
        compose.onNodeWithText("রিপোর্ট জমা দিন").performScrollTo().assertIsEnabled()
    }

    @Test fun notInterestedHasShortReport() {
        selectCategory("NOT INTERESTED")
        assertShortReport()
    }

    @Test fun wrongNumberHasShortReport() {
        selectCategory("WRONG NUMBER")
        assertShortReport()
    }

    @Test fun fakeHasShortReport() {
        selectCategory("FAKE")
        assertShortReport()
    }

    @Test fun switchingBackRestoresAllSixQualificationQuestions() {
        selectCategory("NOT INTERESTED")
        selectCategory("INTERESTED — আগ্রহী")
        LeadEvaluation.questions.forEach { question ->
            compose.onNodeWithText(question.label, substring = true)
                .performScrollTo().assertIsDisplayed()
        }
    }
}