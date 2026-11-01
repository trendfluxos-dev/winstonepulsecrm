package com.winstone.connect.telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import com.winstone.connect.data.AgentSession
import com.winstone.connect.data.remote.WinstoneApi
import com.winstone.connect.data.sync.CallSyncQueue
import com.winstone.connect.data.sync.PendingReportWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The piece that makes a real phone call end up in the CRM.
 *
 * OFFHOOK  -> start recording + tell HQ the agent is on-call
 * IDLE     -> stop recording, queue the upload, set the agent back to idle
 *
 * Register in the manifest:
 * <receiver android:name=".telephony.CallStateReceiver" android:exported="true">
 *   <intent-filter><action android:name="android.intent.action.PHONE_STATE" /></intent-filter>
 * </receiver>
 */
class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val app = context.applicationContext
        // Cold start (incoming call wakes the process): read the synchronous mirror.
        val employeeId = AgentSession.employeeIdNow(app) ?: return

        val outgoing = LiveCallLauncher.activeCallUid != null
        when (state) {
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                if (lastState == TelephonyManager.EXTRA_STATE_OFFHOOK) return
                lastState = state
                offHookAt = System.currentTimeMillis()
                val rec = recorder(app)
                // No audio is captured without this agent's recording consent.
                val consented = RecordingConsent.granted(app, employeeId)
                val started = consented && rec.start(LiveCallLauncher.activeLeadId)
                // Foreground service only once recording really started, so it is never
                // stopped before startForeground() runs (RemoteServiceException).
                if (started) CallRecordingService.start(app)
                LiveCallLauncher.recording = started
                if (!started) {
                    val capability = RecordingCapabilityCheck.cachedOrNull()
                    LiveCallLauncher.recordingIssue =
                        if (!consented) "রেকর্ডিং সম্মতি দেওয়া হয়নি — অডিও রেকর্ড হবে না"
                        else capability?.label ?: "এই ফোনে কল রেকর্ডিং সম্ভব নয়"
                    android.util.Log.w(
                        "WinstoneRecording",
                        "recording unavailable: " + (rec.unavailableReason ?: "unknown"),
                    )
                    CallRecordingService.stop(app)
                }
                LiveCallLauncher.setPhase(CallPhase.Connected)
                // Outgoing OFFHOOK = dialling started, never "answered": the answer
                // and talk time come later from the phone's call history.
                if (outgoing) {
                    reportState(app, CallLifecycle.outgoingState(CallLifecycle.ANDROID_OFFHOOK, false))
                } else if (DialerCallTracker.callUid != null) {
                    // Dialled from the phone's own dialer: the CRM's number-based
                    // contract has no "initiated", so nothing is sent until the
                    // verified outcome (CallOutcomeWorker).
                } else {
                    // Incoming: OFFHOOK after RINGING is a real answer.
                    IncomingCallTracker.ensure(intent.incomingNumber())
                    reportIncoming(app, CallLifecycle.incomingState(CallLifecycle.ANDROID_OFFHOOK, false))
                }
                scope.launch {
                    runCatching { WinstoneApi.postPresence(employeeId, "on_call", leadId = LiveCallLauncher.activeLeadId) }
                }
            }

            TelephonyManager.EXTRA_STATE_IDLE -> {
                val wasOnCall = lastState == TelephonyManager.EXTRA_STATE_OFFHOOK
                lastState = state
                val endedLeadId = LiveCallLauncher.activeLeadId
                val physicalCallUid = LiveCallLauncher.activeCallUid ?: DialerCallTracker.callUid ?: IncomingCallTracker.callUid
                val rec = recorder(app)
                val twoSided = rec.twoSided
                val recorderSource = rec.recorderSource
                val support = RecordingCapabilityCheck.cachedOrNull()?.support ?: RecordingSupport.UNAVAILABLE
                val captured = rec.stopAndGetFile()
                CallRecordingService.stop(app)

                // Policy: only a real two-sided carrier recording is uploaded. A
                // microphone-only file is not a call recording, so it is deleted
                // and the call is reported as recording-unavailable instead.
                val uploadable = CallLifecycle.uploadable(support, captured != null) &&
                    RecordingConsent.granted(app, employeeId)
                if (wasOnCall && captured != null && uploadable) {
                    // An empty/interrupted recording is refused by the queue; show it as a sync failure, never crash.
                    runCatching { CallSyncQueue.queueRecording(
                        context = app,
                        leadId = if (outgoing) LiveCallLauncher.activeLeadId else null,
                        phoneNumber =
                            if (outgoing) LiveCallLauncher.activePhone.orEmpty()
                            else IncomingCallTracker.number.orEmpty(),
                        file = captured.first,
                        durationSeconds = captured.second,
                        twoSided = twoSided,
                        incoming = !outgoing,
                        recorderSource = recorderSource,
                        callUid = physicalCallUid,
                        callStartedAt = if (offHookAt > 0) com.winstone.connect.data.IsoTime.fromMillis(offHookAt) else null,
                    ) }.onFailure { com.winstone.connect.data.sync.SyncStatus.failed(app, "Recording not saved: ${it.message}") }
                } else if (captured != null) {
                    captured.first.delete()
                }

                // The app could not capture both sides itself: pick up the file
                // the phone's own call recorder saved (if it has one turned on).
                if (wasOnCall && !(captured != null && uploadable) && RecordingConsent.granted(app, employeeId)) {
                    val number = when {
                        outgoing -> LiveCallLauncher.activePhone.orEmpty()
                        DialerCallTracker.callUid != null -> DialerCallTracker.number.orEmpty()
                        else -> IncomingCallTracker.number.orEmpty()
                    }
                    com.winstone.connect.data.sync.PhoneRecordingPickupWorker.schedule(
                        context = app,
                        callStartMs = offHookAt,
                        callUid = physicalCallUid,
                        callEndMs = System.currentTimeMillis(),
                        phoneNumber = number,
                        leadId = if (outgoing) endedLeadId else null,
                        incoming = !outgoing && DialerCallTracker.callUid == null,
                    )
                }

                val endedAt = System.currentTimeMillis()
                // Live window: for incoming it starts at answer (talk time); for
                // outgoing it includes ringing, so it is never sent as talk time.
                val duration = if (wasOnCall && offHookAt > 0) ((endedAt - offHookAt) / 1000L).toInt().coerceIn(0, 86400) else 0
                val ended =
                    if (outgoing) CallLifecycle.outgoingState(CallLifecycle.ANDROID_IDLE, wasOnCall)
                    else CallLifecycle.incomingState(CallLifecycle.ANDROID_IDLE, wasOnCall)
                if (outgoing || DialerCallTracker.callUid != null) {
                    val appDialled = outgoing
                    if (wasOnCall) {
                        // Answered or not, and the real talk time, come from the
                        // phone's call history — never from dial-to-hang-up time.
                        com.winstone.connect.data.sync.CallOutcomeWorker.schedule(
                            context = app,
                            callUid = physicalCallUid,
                            phoneNumber = if (appDialled) LiveCallLauncher.activePhone.orEmpty() else DialerCallTracker.number.orEmpty(),
                            leadId = if (appDialled) endedLeadId else null,
                            callStartMs = offHookAt,
                            callEndMs = endedAt,
                            mode = if (appDialled) com.winstone.connect.data.sync.CallOutcomeWorker.MODE_APP
                                else com.winstone.connect.data.sync.CallOutcomeWorker.MODE_DIALER,
                            recordingSupported = uploadable,
                        )
                    } else if (appDialled) {
                        // Never went off-hook: cancelled before dialling, known without call history.
                        reportState(app, ended, 0, uploadable)
                        if (endedLeadId != null) {
                            CallSyncQueue.queueReportOpen(
                                context = app,
                                leadId = endedLeadId,
                                phoneNumber = LiveCallLauncher.activePhone.orEmpty(),
                                durationSeconds = 0,
                                connected = false,
                                callUid = physicalCallUid,
                            )
                        }
                    } else {
                        reportDialer(app, ended, 0, uploadable)
                    }
                    if (!appDialled) DialerCallTracker.clear()
                } else {
                    // Callback finished: the CRM resolves or creates the lead from
                    // the caller's number and opens the same mandatory report.
                    reportIncoming(app, ended, duration, uploadable)
                    IncomingCallTracker.clear()
                }

                // Every finished call becomes reportable, even when recording
                // failed entirely. App-dialled calls that went off-hook get their
                // report from CallOutcomeWorker (connected only with call-history
                // talk time); calls from the phone dialer or incoming calls have
                // no lead id here — the CRM opens their report from the number.
                // Any number, any direction, app open or not: the mandatory
                // report is pushed to the front of the phone once the CRM has
                // opened it. Idempotent — nothing shows if none is pending.
                PendingReportWorker.prompt(app)
                scope.launch {
                    runCatching { WinstoneApi.postPresence(employeeId, "idle", leadId = endedLeadId) }
                }
                LiveCallLauncher.recording = false
                // The overlay collects the outcome, then calls LiveCallLauncher.clear().
                if (wasOnCall) LiveCallLauncher.setPhase(CallPhase.Ended) else LiveCallLauncher.clear()
            }


            TelephonyManager.EXTRA_STATE_RINGING -> {
                lastState = state
                // Only a call the app did not dial is an incoming call.
                if (!outgoing && DialerCallTracker.callUid == null) {
                    IncomingCallTracker.begin(intent.incomingNumber())
                    reportIncoming(app, CallLifecycle.incomingState(CallLifecycle.ANDROID_RINGING, false))
                }
            }

            else -> lastState = state
        }
    }

    /** The caller's number, when Android is willing to tell us (needs READ_CALL_LOG). */
    private fun Intent.incomingNumber(): String? =
        getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)?.trim()?.takeIf { it.isNotBlank() }

    /**
     * Queues one observed state of an incoming call. There is no lead id yet —
     * the CRM resolves the lead from the caller's number, and creates it when the
     * number is new, so a callback is never lost.
     */
    private fun reportIncoming(
        app: Context,
        callState: CallState,
        durationSeconds: Int = 0,
        recordingCaptured: Boolean? = null,
    ) {
        val wire = callState.wire ?: return
        val callUid = IncomingCallTracker.callUid ?: return
        val number = IncomingCallTracker.number ?: return
        CallSyncQueue.queueIncomingCall(
            context = app,
            callUid = callUid,
            phoneNumber = number,
            state = wire,
            durationSeconds = durationSeconds,
            recordingSupported = recordingCaptured,
            recordingNote = RecordingCapabilityCheck.cachedOrNull()?.reason,
        )
    }

    /**
     * Queues one observed state of a call dialled outside the app. The CRM
     * matches the number to a lead (creating it when new) and opens the same
     * mandatory report, so work done from the phone dialer is never missing.
     */
    private fun reportDialer(
        app: Context,
        callState: CallState,
        durationSeconds: Int = 0,
        recordingCaptured: Boolean? = null,
    ) {
        val wire = callState.wire ?: return
        val callUid = DialerCallTracker.callUid ?: return
        val number = DialerCallTracker.number ?: return
        CallSyncQueue.queueIncomingCall(
            context = app,
            callUid = callUid,
            phoneNumber = number,
            state = wire,
            durationSeconds = durationSeconds,
            recordingSupported = recordingCaptured,
            recordingNote = RecordingCapabilityCheck.cachedOrNull()?.reason,
            direction = "outgoing",
        )
    }

    /**
     * Queues one observed call state. States we cannot observe are dropped, and
     * a call that was never started from the app has no id to report against.
     */
    private fun reportState(
        app: Context,
        callState: CallState,
        durationSeconds: Int = 0,
        recordingCaptured: Boolean? = null,
    ) {
        val wire = callState.wire ?: return
        val callUid = LiveCallLauncher.activeCallUid ?: return
        val leadId = LiveCallLauncher.activeLeadId ?: return
        CallSyncQueue.queueCallState(
            context = app,
            callUid = callUid,
            leadId = leadId,
            state = wire,
            durationSeconds = durationSeconds,
            phoneNumber = LiveCallLauncher.activePhone,
            recordingSupported = recordingCaptured,
            recordingNote = RecordingCapabilityCheck.cachedOrNull()?.reason,
        )
    }

    companion object {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private var lastState: String? = null
        private var offHookAt: Long = 0L
        private var shared: CallRecorder? = null

        /** One recorder per process so OFFHOOK and IDLE talk to the same instance. */
        fun recorder(context: Context): CallRecorder =
            shared ?: CallRecorder(context.applicationContext).also { shared = it }
    }
}
