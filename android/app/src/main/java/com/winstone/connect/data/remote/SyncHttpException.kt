package com.winstone.connect.data.remote

/**
 * A CRM request that reached the server and was refused. Keeps the HTTP status
 * so the sync queue can tell a retryable failure (network, 429, 5xx) from a
 * permanent one (bad data, not your lead). `message` stays the server's short
 * error text, exactly as before, so existing checks keep working.
 */
class SyncHttpException(
    val code: Int,
    message: String,
    val retryAfterSeconds: Long? = null,
) : IllegalStateException(message)
