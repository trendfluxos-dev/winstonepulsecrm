package com.winstone.connect.data.sync

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.winstone.connect.telephony.CallHistoryEvidence
import com.winstone.connect.telephony.CallHistoryRow
import com.winstone.connect.telephony.CallVerdict
import java.util.concurrent.TimeUnit

/**
 * Decides how a dialled call really ended, from the phone's own call history.
 *
 * Runs a few seconds after hang-up (the system writes the call-history row
 * after IDLE, sometimes late), retries briefly while the row is missing, then
 * queues the verified outcome through the normal idempotent sync queue:
 * answered + talk time, unanswered, or "not verified". Survives process death.
 */
class CallOutcomeWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val uid = inputData.getString(KEY_UID) ?: return Result.success()
        val phone = inputData.getString(KEY_PHONE).orEmpty()
        val leadId = inputData.getString(KEY_LEAD)
        val start = inputData.getLong(KEY_START, 0L)
        val end = inputData.getLong(KEY_END, 0L)
        val mode = inputData.getString(KEY_MODE) ?: MODE_APP
        val recordingSupported = when (inputData.getInt(KEY_RECORDING, -1)) { 1 -> true; 0 -> false; else -> null }

        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALL_LOG) ==
            PackageManager.PERMISSION_GRANTED
        val rows = if (granted) query(ctx, start - CallHistoryEvidence.MATCH_BEFORE_MS) else null
        val row = rows?.let { CallHistoryEvidence.pick(it, phone, start, end, outgoing = true) }
        // The row can appear a little after hang-up: wait for it before calling it unavailable.
        if (granted && row == null && runAttemptCount < MAX_ATTEMPTS) return Result.retry()

        val window = if (end > start) ((end - start) / 1000L).toInt() else 0
        val outcome = CallHistoryEvidence.resolve(row, window)
        val note = CallHistoryEvidence.note(outcome)
        val wire = outcome.state.wire ?: return Result.success()

        if (mode == MODE_DIALER) {
            CallSyncQueue.queueIncomingCall(
                context = ctx,
                callUid = uid,
                phoneNumber = phone,
                state = wire,
                durationSeconds = outcome.talkSeconds,
                recordingSupported = recordingSupported,
                recordingNote = note,
                direction = "outgoing",
            )
        } else if (leadId != null) {
            CallSyncQueue.queueCallState(
                context = ctx,
                callUid = uid,
                leadId = leadId,
                state = wire,
                durationSeconds = outcome.talkSeconds,
                phoneNumber = phone,
                recordingSupported = recordingSupported,
                recordingNote = note,
            )
            CallSyncQueue.queueReportOpen(
                context = ctx,
                leadId = leadId,
                phoneNumber = phone,
                durationSeconds = outcome.talkSeconds,
                connected = outcome.connected,
                callUid = uid,
            )
        }
        if (outcome.verdict == CallVerdict.UNAVAILABLE) {
            SyncStatus.retrying(
                ctx,
                if (granted) "Call history row not found — answer and talk time not verified"
                else "Call history permission off — answer and talk time not verified",
            )
        }
        PendingReportWorker.prompt(ctx)
        return Result.success()
    }

    private fun query(ctx: Context, sinceMs: Long): List<CallHistoryRow>? = runCatching {
        ctx.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION),
            "${CallLog.Calls.DATE} >= ?",
            arrayOf(sinceMs.toString()),
            "${CallLog.Calls.DATE} DESC",
        )?.use { c ->
            val num = c.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val type = c.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val date = c.getColumnIndexOrThrow(CallLog.Calls.DATE)
            val dur = c.getColumnIndexOrThrow(CallLog.Calls.DURATION)
            val out = ArrayList<CallHistoryRow>()
            while (out.size < 20 && c.moveToNext()) {
                out += CallHistoryRow(c.getInt(type), c.getLong(date), c.getInt(dur), c.getString(num).orEmpty())
            }
            out
        }
    }.getOrNull()

    companion object {
        private const val KEY_UID = "uid"
        private const val KEY_PHONE = "phone"
        private const val KEY_LEAD = "lead"
        private const val KEY_START = "start"
        private const val KEY_END = "end"
        private const val KEY_MODE = "mode"
        private const val KEY_RECORDING = "recording"
        const val MODE_APP = "app"
        const val MODE_DIALER = "dialer"
        private const val MAX_ATTEMPTS = 4

        fun schedule(
            context: Context,
            callUid: String?,
            phoneNumber: String,
            leadId: String?,
            callStartMs: Long,
            callEndMs: Long,
            mode: String,
            recordingSupported: Boolean?,
        ) {
            val uid = callUid ?: return
            val request = OneTimeWorkRequestBuilder<CallOutcomeWorker>()
                .setInitialDelay(4, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 5, TimeUnit.SECONDS)
                .setInputData(
                    Data.Builder()
                        .putString(KEY_UID, uid)
                        .putString(KEY_PHONE, phoneNumber)
                        .putString(KEY_LEAD, leadId)
                        .putLong(KEY_START, callStartMs)
                        .putLong(KEY_END, callEndMs)
                        .putString(KEY_MODE, mode)
                        .putInt(KEY_RECORDING, when (recordingSupported) { true -> 1; false -> 0; null -> -1 })
                        .build(),
                )
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork("call_outcome_$uid", ExistingWorkPolicy.KEEP, request)
        }
    }
}
