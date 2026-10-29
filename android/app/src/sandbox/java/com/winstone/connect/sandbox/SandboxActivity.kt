package com.winstone.connect.sandbox

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.provider.CallLog
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.winstone.connect.telephony.CallLogClassifier
import org.json.JSONArray
import org.json.JSONObject

/** Offline-only harness. No CRM session, receiver, worker, audio upload or HTTP client. */
class SandboxActivity : ComponentActivity() {
    private val startedAt = System.currentTimeMillis()
    private var permission = "unknown"
    private var recording = "not_checked"
    private var audioDurationMs = 0
    private var calls = JSONArray()
    private var summary = "not_run"
    private var summaryText = ""
    private var player: MediaPlayer? = null
    private var audioUri: Uri? = null
    private lateinit var status: TextView
    private lateinit var transcript: EditText
    private val askPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        permission = if (it) "granted" else "denied"
        refresh()
    }
    private val pickAudio = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            player?.release()
            audioUri = uri
            player = null
            recording = "unreadable"
            audioDurationMs = 0
            runCatching {
                val media = MediaPlayer()
                player = media
                media.setDataSource(this, uri)
                media.prepare()
                audioDurationMs = media.duration
                recording = "local_file_readable"
            }.onFailure { player?.release(); player = null }
            refresh()
        }
    }
    private val saveResults = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) runCatching {
            contentResolver.openOutputStream(uri)?.use { it.write(export().toString(2).toByteArray()) }
        }.onFailure { Toast.makeText(this, "Could not save results", Toast.LENGTH_LONG).show() }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 28, 24, 28) }
        setContentView(ScrollView(this).apply { addView(layout) })
        fun label(text: String) { layout.addView(TextView(this).apply { this.text = text; textSize = 16f; setPadding(0, 12, 0, 12) }) }
        fun action(text: String, run: () -> Unit) { layout.addView(Button(this).apply { this.text = text; setOnClickListener { run() } }) }
        label("WINSTONE SANDBOX · OFFLINE\nSynthetic lead: Sandbox customer 001\nNo sign-in, live CRM access or uploads. Calls through the phone dialer are real and may incur carrier charges. Use a consenting test contact.")
        val number = EditText(this).apply { hint = "Your consenting test contact number"; inputType = android.text.InputType.TYPE_CLASS_PHONE }
        layout.addView(number)
        action("Open phone dialer") {
            val value = number.text.toString().trim()
            if (value.matches(Regex("\\+?[0-9]{7,15}"))) runCatching {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", value, null)))
            }.onFailure { Toast.makeText(this, "Phone dialer unavailable", Toast.LENGTH_SHORT).show() }
            else Toast.makeText(this, "Enter a valid consenting test number", Toast.LENGTH_SHORT).show()
        }
        action("Allow call-log access") { askPermission.launch(Manifest.permission.READ_CALL_LOG) }
        action("Check this test contact’s calls") { checkCalls(number.text.toString()) }
        label("Call-log evidence is read after returning to this screen; this harness does not test background receiver recovery. Only calls since this screen opened and matching the entered number are selected. Phone numbers are never exported.")
        action("Choose phone-recorder audio") { pickAudio.launch(arrayOf("audio/*")) }
        action("Play / pause local audio") { runCatching { player?.let { if (it.isPlaying) it.pause() else it.start() } } }
        label("Audio stays on this phone. A readable file does not prove it belongs to the call or that both voices are audible. Listen to verify. WhatsApp recording is not guaranteed.")
        transcript = EditText(this).apply { hint = "Optional synthetic transcript for summary-processing simulation"; minLines = 3; maxLines = 6 }
        layout.addView(transcript)
        action("Simulate summary processing") {
            val text = transcript.text.toString().trim()
            summary = if (text.isEmpty()) "simulation_failed" else "simulation_saved"
            summaryText = text.take(240)
            refresh()
        }
        label("Summary simulation copies the supplied synthetic text. It does not transcribe audio, call AI or verify the live summary service.")
        action("Export sandbox results") { saveResults.launch("winstone-sandbox-results.json") }
        status = TextView(this).apply { textSize = 15f }
        layout.addView(status)
        refresh()
    }
    private fun checkCalls(raw: String) {
        if (checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            permission = "denied"; calls = JSONArray(); refresh(); return
        }
        permission = "granted"
        val normalized = raw.filter { it.isDigit() }.takeLast(10)
        if (normalized.length < 7) { Toast.makeText(this, "Enter the test contact number first", Toast.LENGTH_SHORT).show(); return }
        calls = JSONArray()
        runCatching {
            contentResolver.query(CallLog.Calls.CONTENT_URI, arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.TYPE, CallLog.Calls.DURATION), "${CallLog.Calls.DATE} >= ?", arrayOf(startedAt.toString()), "${CallLog.Calls.DATE} DESC")?.use { cursor ->
                while (cursor.moveToNext() && calls.length() < 20) {
                    if (cursor.getString(0)?.filter { it.isDigit() }?.takeLast(10) != normalized) continue
                    val type = cursor.getInt(2)
                    calls.put(JSONObject().put("leadId", "synthetic-001").put("at", cursor.getLong(1)).put("type", type).put("durationSeconds", cursor.getLong(3)))
                }
            } ?: error("Call log unavailable")
        }.onFailure { permission = "read_failed"; calls = JSONArray() }
        refresh()
    }
    private fun export() = JSONObject().put("format", "winstone-sandbox-v1").put("synthetic", true)
        .put("checkedAt", System.currentTimeMillis()).put("callLogAccess", permission).put("calls", calls)
        .put("recording", recording).put("audioDurationMs", audioDurationMs).put("summary", summary)
        .put("summaryText", summaryText).put("liveWrites", 0)
    private fun refresh() { status.text = "Call-log access: $permission\nMatching calls: ${calls.length()}\nRecording: $recording ($audioDurationMs ms)\nSummary: $summary" }
    override fun onDestroy() { player?.release(); player = null; super.onDestroy() }
}