package com.winstone.connect.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Device token storage backed by the Android Keystore (AES-256 master key).
 * The token is never written to DataStore or the plain mirror. If the
 * Keystore is unavailable the token is NOT stored in plain text — the agent
 * must sign in again (fail closed).
 */
object SecureTokenStore {
    private const val FILE = "winstone_secure_session"
    private const val K_TOKEN = "device_token"

    @Volatile private var prefs: SharedPreferences? = null

    private fun open(context: Context): SharedPreferences? {
        prefs?.let { return it }
        return runCatching {
            val app = context.applicationContext
            val key = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            EncryptedSharedPreferences.create(
                app, FILE, key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }.getOrNull()?.also { prefs = it }
    }

    fun read(context: Context): String? = open(context)?.getString(K_TOKEN, null)

    /** Returns false when secure storage is unavailable (token not kept). */
    fun write(context: Context, token: String): Boolean =
        open(context)?.edit()?.putString(K_TOKEN, token)?.commit() ?: false

    fun clear(context: Context) {
        open(context)?.edit()?.clear()?.commit()
    }
}
