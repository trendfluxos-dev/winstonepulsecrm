package com.winstone.connect.data.sync

import android.content.Context
import com.winstone.connect.data.IsoTime
import com.winstone.connect.data.remote.WinstoneApi
import org.json.JSONArray
import org.json.JSONObject

/**
 * Keeps a small local log of sync failures and sends it to the CRM
 * (/api/public/agent/sync-failures) the next time a sync succeeds, so IT can see
 * what went wrong on each phone. Network failures are therefore reported after
 * reconnecting. Never blocks or fails the sync itself.
 */
object SyncFailureReporter {
    private const val PREFS = "winstone_sync_failure_log"
    private const val KEY = "entries"

    @Synchronized
    fun record(
        context: Context,
        itemKind: String?,
        errorKind: String,
        httpStatus: Int?,
        attempt: Int,
        permanent: Boolean,
        callUid: String?,
    ) {
        runCatching {
            val next = SyncFailureLog.merge(
                load(context), SyncFailureLog.itemKind(itemKind), errorKind, httpStatus, attempt, permanent,
                SyncDiagnostics.fingerprint(callUid), IsoTime.now(),
            )
            save(context, next)
        }
    }

    /** Sends pending entries; safe to call after any successful sync. */
    suspend fun flush(context: Context) {
        val snapshot = synchronized(this) { load(context) }
        if (snapshot.isEmpty()) return
        val sent = snapshot.values.toList()
        val ok = runCatching { WinstoneApi.postSyncFailures(JSONArray().apply { sent.forEach { put(toJson(it)) } }) }.isSuccess
        if (ok) synchronized(this) { save(context, SyncFailureLog.acknowledge(load(context), sent)) }
    }

    private fun toJson(e: SyncFailureEntry) = JSONObject().apply {
        put("id", e.id)
        put("item_kind", e.itemKind)
        put("error_kind", e.errorKind)
        e.httpStatus?.let { put("http_status", it) }
        put("attempts", e.attempts.coerceIn(0, 9999))
        put("count", e.count.coerceIn(1, 9999))
        put("permanent", e.permanent)
        e.callRef?.let { put("call_ref", it) }
        put("first_at", e.firstAt)
        put("last_at", e.lastAt)
    }

    private fun load(context: Context): Map<String, SyncFailureEntry> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyMap()
        return runCatching {
            val arr = JSONArray(raw)
            val out = LinkedHashMap<String, SyncFailureEntry>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val e = SyncFailureEntry(
                    id = o.getString("id"),
                    itemKind = o.getString("item_kind"),
                    errorKind = o.getString("error_kind"),
                    httpStatus = if (o.has("http_status")) o.getInt("http_status") else null,
                    attempts = o.optInt("attempts", 0),
                    count = o.optInt("count", 1),
                    permanent = o.optBoolean("permanent", false),
                    callRef = if (o.has("call_ref")) o.getString("call_ref") else null,
                    firstAt = o.getString("first_at"),
                    lastAt = o.getString("last_at"),
                )
                out[SyncFailureLog.key(e.itemKind, e.errorKind, e.callRef)] = e
            }
            out
        }.getOrDefault(emptyMap())
    }

    private fun save(context: Context, log: Map<String, SyncFailureEntry>) {
        val arr = JSONArray().apply { log.values.forEach { put(toJson(it)) } }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
    }
}
