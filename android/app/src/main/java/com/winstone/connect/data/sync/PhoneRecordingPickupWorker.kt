package com.winstone.connect.data.sync

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.winstone.connect.telephony.PhoneRecordingMatcher
import com.winstone.connect.telephony.RecordingCandidate
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Picks up the recording made by the phone's OWN call recorder after a call
 * ends and hands it to the normal upload queue (same idempotent path as every
 * other recording). Runs only when the app could not capture both sides itself.
 *
 * The OEM recorder finishes writing a few seconds after hang-up, so this worker
 * waits, then retries a few times. If no matching file appears, nothing is
 * uploaded — the call stays "recording unavailable", never faked.
 */
class PhoneRecordingPickupWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        // Bound to the agent who made the call: a later sign-in by someone else
        // must never pick up this audio as theirs.
        val owner = inputData.getString(KEY_OWNER)
        val current = com.winstone.connect.data.AgentSession.employeeIdNow(ctx)
        if (owner.isNullOrBlank() || current.isNullOrBlank() || !owner.trim().equals(current.trim(), ignoreCase = true)) {
            if (owner.isNullOrBlank() || !current.isNullOrBlank()) return Result.success() // other agent / unbound: never attach
            return Result.retry() // nobody signed in yet: wait for the same agent
        }
        // Consent may have been withdrawn after the call.
        if (!com.winstone.connect.telephony.RecordingConsent.granted(ctx, owner)) {
            return Result.success()
        }
        if (!canReadAudio(ctx)) {
            SyncStatus.retrying(ctx, "Audio permission required — allow phone recording access in Android Settings")
            return Result.retry()
        }
        val start = inputData.getLong(KEY_START, 0L)
        val end = inputData.getLong(KEY_END, 0L)
        val phone = inputData.getString(KEY_PHONE).orEmpty()
        val uid = inputData.getString(KEY_UID) ?: return Result.success()

        val decision = PhoneRecordingMatcher.decide(query(ctx, start), start, end, phone)
        if (decision.outcome == com.winstone.connect.telephony.MatchOutcome.AMBIGUOUS) {
            // Waiting will not make it less ambiguous; never guess which file is this call.
            SyncStatus.failed(ctx, "Several phone recordings match this call — none uploaded to avoid attaching the wrong one / একাধিক রেকর্ডিং মিলেছে — ভুল কলে যুক্ত না করতে কোনোটি পাঠানো হয়নি")
            SyncFailureReporter.record(ctx, "recording_pickup", "RECORDING_AMBIGUOUS", null, runAttemptCount + 1, permanent = true, callUid = uid)
            return Result.failure()
        }
        val match = decision.candidate
        if (match == null) {
            val message = "No matching phone recording found; call report sync is separate from audio"
            if (runAttemptCount < MAX_ATTEMPTS) {
                SyncStatus.retrying(ctx, message)
                return Result.retry()
            }
            SyncStatus.retrying(ctx, "Recording pickup exhausted retries; audio remains unavailable and call report sync is separate")
            return Result.failure()
        }

        val ext = match.displayName.substringAfterLast('.', "m4a").lowercase().take(5)
        val dir = File(ctx.filesDir, "phone_recording_pickup").apply { mkdirs() }
        // Stable name = stable client_upload_id, so a retry never makes a second row.
        val copy = File(dir, "phone_${uid}.$ext")
        val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, match.id)
        val ok = runCatching {
            ctx.contentResolver.openInputStream(uri)?.use { input ->
                copy.outputStream().use { input.copyTo(it) }
            } != null
        }.getOrDefault(false)
        if (!ok || copy.length() < 1_024) {
            copy.delete()
            if (runAttemptCount < MAX_ATTEMPTS) {
                SyncStatus.retrying(ctx, "Phone recording copy failed; retrying pickup")
                return Result.retry()
            }
            SyncStatus.retrying(ctx, "Recording pickup exhausted retries after copy failure; call report sync is separate")
            return Result.failure()
        }

        val seconds = when {
            match.durationMs > 0 -> (match.durationMs / 1000L).toInt()
            else -> ((end - start) / 1000L).toInt()
        }.coerceAtLeast(1)

        try {
            CallSyncQueue.queueRecording(
                context = ctx,
                leadId = inputData.getString(KEY_LEAD),
                phoneNumber = phone,
                file = copy,
                durationSeconds = seconds,
                // Phone dialer recorders capture the call line itself (both sides).
                twoSided = true,
                incoming = inputData.getBoolean(KEY_INCOMING, false),
                recorderSource = SOURCE,
                callUid = uid,
                callStartedAt = com.winstone.connect.data.IsoTime.fromMillis(start),
                ownerEmployeeId = owner,
            )
        } catch (e: Exception) {
            SyncStatus.retrying(ctx, "Could not persist phone recording; retrying without deleting the pickup copy")
            return if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
        }
        // queueRecording has committed a durable copy and enqueued its upload.
        // Remove the intermediate pickup copy only after that succeeds.
        copy.delete()
        return Result.success()
    }

    private fun query(ctx: Context, startMs: Long): List<RecordingCandidate> {
        val pathCol =
            if (Build.VERSION.SDK_INT >= 29) MediaStore.Audio.Media.RELATIVE_PATH
            else @Suppress("DEPRECATION") MediaStore.Audio.Media.DATA
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            pathCol,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.DURATION,
        )
        val sinceSec = ((startMs - PhoneRecordingMatcher.BEFORE_START_MS) / 1000L).toString()
        val out = mutableListOf<RecordingCandidate>()
        runCatching {
            ctx.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                "${MediaStore.Audio.Media.DATE_MODIFIED} >= ? OR ${MediaStore.Audio.Media.DATE_ADDED} >= ?",
                arrayOf(sinceSec, sinceSec),
                "${MediaStore.Audio.Media.DATE_MODIFIED} DESC",
            )?.use { c ->
                while (c.moveToNext() && out.size < 40) {
                    val added = c.getLong(3) * 1000L
                    val modified = c.getLong(4) * 1000L
                    out += RecordingCandidate(
                        id = c.getLong(0),
                        displayName = c.getString(1).orEmpty(),
                        path = c.getString(2).orEmpty(),
                        writtenAtMs = maxOf(added, modified),
                        durationMs = c.getLong(5),
                    )
                }
            }
        }
        return out
    }

    companion object {
        const val SOURCE = "phone_recorder"
        private const val MAX_ATTEMPTS = 5
        private const val KEY_START = "start"
        private const val KEY_END = "end"
        private const val KEY_PHONE = "phone"
        private const val KEY_LEAD = "lead"
        private const val KEY_INCOMING = "incoming"
        private const val KEY_UID = "uid"
        private const val KEY_OWNER = "owner_employee_id"

        fun canReadAudio(ctx: Context): Boolean {
            val perm =
                if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
                else Manifest.permission.READ_EXTERNAL_STORAGE
            return ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED
        }

        fun schedule(
            context: Context,
            callStartMs: Long,
            callUid: String? = null,
            callEndMs: Long,
            phoneNumber: String,
            leadId: String?,
            incoming: Boolean,
            /** Agent who made the call; the pickup never attaches audio to anyone else. */
            ownerEmployeeId: String?,
        ) {
            if (callStartMs <= 0L || callUid == null || ownerEmployeeId.isNullOrBlank()) return
            val uid = callUid
            val request = OneTimeWorkRequestBuilder<PhoneRecordingPickupWorker>()
                .setInitialDelay(12, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 20, TimeUnit.SECONDS)
                .setInputData(
                    Data.Builder()
                        .putLong(KEY_START, callStartMs)
                        .putLong(KEY_END, callEndMs)
                        .putString(KEY_PHONE, phoneNumber)
                        .putString(KEY_LEAD, leadId)
                        .putBoolean(KEY_INCOMING, incoming)
                        .putString(KEY_UID, uid)
                        .putString(KEY_OWNER, ownerEmployeeId)
                        .build(),
                )
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("phone_rec_$uid", ExistingWorkPolicy.KEEP, request)
        }
    }
}
