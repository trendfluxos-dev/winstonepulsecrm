package com.winstone.connect.data.sync

import com.winstone.connect.data.remote.SyncHttpException
import java.io.IOException

/** Why a queued item did not reach the CRM. */
enum class SyncErrorKind {
    NETWORK,
    SERVER_BUSY,
    SERVER_ERROR,
    SIGN_IN_REQUIRED,
    BRIEFING_REQUIRED,
    ACCESS_DENIED,
    NOT_FOUND,
    CONFLICT,
    INVALID_DATA,
    APP_UPDATE_REQUIRED,
    UNKNOWN,
}

/**
 * [retryable] = the same request can succeed later without anyone changing it.
 * [agentMessage] = short bilingual line telling the agent what happened and what to do.
 */
data class SyncFailure(val kind: SyncErrorKind, val retryable: Boolean, val agentMessage: String)

/**
 * Pure classification of sync failures (JVM-testable). Permanent failures stop
 * retrying so the queue does not loop forever on something that cannot succeed;
 * the item stays visible as Failed with the reason, and "Retry failed uploads"
 * can resend it after the cause is fixed.
 */
object SyncErrorClassifier {

    fun classify(error: Throwable): SyncFailure = when (error) {
        is SyncHttpException -> classify(error.code, error.message.orEmpty())
        is IOException -> of(SyncErrorKind.NETWORK)
        else -> of(SyncErrorKind.UNKNOWN)
    }

    fun classify(httpCode: Int, serverMessage: String): SyncFailure {
        val msg = serverMessage.lowercase()
        return when {
            httpCode == 401 -> of(SyncErrorKind.SIGN_IN_REQUIRED)
            httpCode == 409 && (msg.contains("briefing") || serverMessage.contains("ব্রিফিং")) -> of(SyncErrorKind.BRIEFING_REQUIRED)
            httpCode == 409 -> of(SyncErrorKind.CONFLICT)
            httpCode == 403 -> of(SyncErrorKind.ACCESS_DENIED)
            httpCode == 404 -> of(SyncErrorKind.NOT_FOUND)
            httpCode == 410 || httpCode == 426 -> of(SyncErrorKind.APP_UPDATE_REQUIRED)
            httpCode == 408 || httpCode == 429 -> of(SyncErrorKind.SERVER_BUSY)
            httpCode in 500..599 -> of(SyncErrorKind.SERVER_ERROR)
            httpCode in 400..499 -> of(SyncErrorKind.INVALID_DATA)
            else -> of(SyncErrorKind.UNKNOWN)
        }
    }

    fun of(kind: SyncErrorKind): SyncFailure = when (kind) {
        SyncErrorKind.NETWORK -> SyncFailure(kind, true,
            "ইন্টারনেট নেই — সংযোগ পেলে নিজে থেকেই পাঠানো হবে / No internet — will send automatically when online")
        SyncErrorKind.SERVER_BUSY -> SyncFailure(kind, true,
            "CRM ব্যস্ত — কিছুক্ষণ পর আবার চেষ্টা হবে / CRM busy — retrying shortly")
        SyncErrorKind.SERVER_ERROR -> SyncFailure(kind, true,
            "CRM সাময়িকভাবে সাড়া দিচ্ছে না — আবার চেষ্টা হবে; বারবার হলে IT-কে জানান / CRM temporarily unavailable — retrying; tell IT if it repeats")
        SyncErrorKind.SIGN_IN_REQUIRED -> SyncFailure(kind, true,
            "আবার সাইন ইন করুন — অপেক্ষমাণ কাজ তারপর পাঠানো হবে / Sign in again — waiting work will send after")
        SyncErrorKind.BRIEFING_REQUIRED -> SyncFailure(kind, true,
            "আজকের ৯:০৫ ব্রিফিং স্বীকার করুন — তারপর পাঠানো হবে / Accept today's 9:05 briefing — then it will send")
        SyncErrorKind.ACCESS_DENIED -> SyncFailure(kind, false,
            "এই লিড আপনার নামে নেই — LeadHub/IT-কে জানান / This lead is not assigned to you — contact LeadHub/IT")
        SyncErrorKind.NOT_FOUND -> SyncFailure(kind, false,
            "CRM-এ লিডটি পাওয়া যায়নি — IT-কে জানান / Lead not found in CRM — contact IT")
        SyncErrorKind.CONFLICT -> SyncFailure(kind, false,
            "এই কল আগে অন্য লিড/এজেন্টে সেভ হয়েছে — IT-কে জানান / This call is already saved for another lead or agent — contact IT")
        SyncErrorKind.INVALID_DATA -> SyncFailure(kind, false,
            "তথ্য CRM গ্রহণ করেনি — রিপোর্ট আবার পূরণ করুন বা IT-কে জানান / CRM rejected the data — re-enter the report or contact IT")
        SyncErrorKind.APP_UPDATE_REQUIRED -> SyncFailure(kind, false,
            "অ্যাপ আপডেট করুন — এই পুরোনো সংস্করণ আর গ্রহণ হয় না / Update the app — this version is no longer accepted")
        SyncErrorKind.UNKNOWN -> SyncFailure(kind, true,
            "পাঠানো যায়নি — আবার চেষ্টা হবে / Could not send — retrying")
    }
}
