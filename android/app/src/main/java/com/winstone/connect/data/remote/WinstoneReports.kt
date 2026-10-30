package com.winstone.connect.data.remote

import com.winstone.connect.data.AgentSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Own-work reports summary for the signed-in agent.
 *
 * Authenticates only with the per-agent device token (AgentSession.deviceToken),
 * like WinstoneApi. No shared secret ships in the APK, and the server decides
 * whose data is returned, so no employee id / role is sent. Payloads and the
 * token are never logged.
 */
object WinstoneReports {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    sealed class Result {
        data class Ok(val body: JSONObject) : Result()
        /** Missing, invalid or revoked device token: sign in again. */
        object SignedOut : Result()
        /** Account is not allowed to view this summary. */
        object Forbidden : Result()
        data class Failed(val message: String) : Result()
    }

    private val DAY = Regex("""^\d{4}-\d{2}-\d{2}$""")

    fun buildUrl(baseUrl: String, from: String?, to: String?): String {
        val b = "$baseUrl/api/public/reports/summary".toHttpUrl().newBuilder()
        from?.takeIf { DAY.matches(it) }?.let { b.addQueryParameter("from", it) }
        to?.takeIf { DAY.matches(it) }?.let { b.addQueryParameter("to", it) }
        return b.build().toString()
    }

    fun classify(code: Int): Result? = when (code) {
        401 -> Result.SignedOut
        403 -> Result.Forbidden
        else -> null
    }

    suspend fun fetchSummary(from: String? = null, to: String? = null): Result = withContext(Dispatchers.IO) {
        val token = AgentSession.deviceToken
        if (token.isNullOrBlank()) return@withContext Result.SignedOut
        val req = Request.Builder()
            .url(buildUrl(WinstoneApi.BASE_URL, from, to))
            .header("x-device-token", token)
            .get()
            .build()
        runCatching {
            client.newCall(req).execute().use { res ->
                classify(res.code)?.let { return@use it }
                val body = runCatching { JSONObject(res.body?.string().orEmpty()) }.getOrElse { JSONObject() }
                if (res.isSuccessful) Result.Ok(body) else Result.Failed(body.optString("error", "HTTP ${res.code}"))
            }
        }.getOrElse { Result.Failed("Network unavailable") }
    }
}
