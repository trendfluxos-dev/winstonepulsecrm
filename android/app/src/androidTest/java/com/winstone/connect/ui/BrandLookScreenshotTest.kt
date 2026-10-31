package com.winstone.connect.ui

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.assertIsDisplayed
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.winstone.connect.BuildConfig
import com.winstone.connect.data.Lead
import com.winstone.connect.ui.theme.WinstoneTheme
import org.json.JSONObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Renders the key agent screens with the real brand theme on the emulator and
 * saves full-screen captures for visual review. Offline sandbox, synthetic
 * sample names only — never submits, signs in or reaches the CRM.
 */
@RunWith(AndroidJUnit4::class)
class BrandLookScreenshotTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun sandboxOnly() {
        check(BuildConfig.BUILD_TYPE == "sandbox") { "Screenshots require the offline sandbox" }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        Thread.sleep(1_200)
        val shot: Bitmap = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
            ?: error("screenshot failed")
        val dir = File(compose.activity.getExternalFilesDir(null), "brand-shots").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    fun signIn() {
        compose.setContent { WinstoneTheme { SignInScreen(error = null, onSignIn = { _, _ -> }) } }
        compose.onNodeWithContentDescription("Winstone Pulse logo").assertIsDisplayed()
        capture("01-sign-in")
    }

    @Test
    fun roleSelection() {
        compose.setContent {
            WinstoneTheme { RoleSelectionScreen(agentName = "Sample Agent", allowedRoles = listOf("agent"), onSelectRole = {}) }
        }
        capture("02-role-selection")
    }

    @Test
    fun recordingConsent() {
        compose.setContent {
            WinstoneTheme { RecordingConsentScreen(agentName = "Sample Agent", onAccept = {}, onDecline = {}) }
        }
        capture("03-recording-consent")
    }

    @Test
    fun agentHome() {
        val sample = listOf(
            Lead("sample-1", "Sample Customer", "01700000000", null, "Dhaka", "pending", 0, null),
            Lead("sample-2", "Sample Buyer", "01800000000", null, "Gulshan", "follow_up", 2, null),
        )
        compose.setContent {
            WinstoneTheme {
                androidx.compose.material3.Surface {
                    AgentDashboardScreen(
                        activity = compose.activity,
                        agentName = "Sample Agent",
                        employeeId = "WS-0000",
                        leads = sample,
                        onStartCall = {},
                    )
                }
            }
        }
        capture("04-agent-home")
    }

    @Test
    fun callReport() {
        compose.setContent {
            WinstoneTheme {
                ReportSheet(
                    notes = "",
                    loadPendingReport = {
                        JSONObject().put("pending", JSONObject()
                            .put("id", "synthetic-brand-report")
                            .put("duration_seconds", 95)
                            .put("connected", true))
                    },
                )
            }
        }
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText("কলের ধরন:", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        capture("05-call-report")
    }
}
