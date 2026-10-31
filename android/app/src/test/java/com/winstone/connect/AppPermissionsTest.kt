package com.winstone.connect

import android.Manifest
import com.winstone.connect.telephony.AppPermissions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPermissionsTest {
    private fun perms(sdk: Int, consented: Boolean) = AppPermissions.wanted(sdk, consented).map { it.permission }

    @Test fun phoneAndCallLogAreAlwaysAsked() {
        val p = perms(34, consented = false)
        assertTrue(Manifest.permission.CALL_PHONE in p)
        assertTrue(Manifest.permission.READ_PHONE_STATE in p)
        assertTrue(Manifest.permission.READ_CALL_LOG in p)
    }

    @Test fun microphoneNeverAskedBeforeConsent() {
        val p = perms(34, consented = false)
        assertFalse(Manifest.permission.RECORD_AUDIO in p)
        assertFalse(Manifest.permission.READ_MEDIA_AUDIO in p)
    }

    @Test fun microphoneAndRecorderFilesAskedAfterConsent() {
        val p = perms(34, consented = true)
        assertTrue(Manifest.permission.RECORD_AUDIO in p)
        assertTrue(Manifest.permission.READ_MEDIA_AUDIO in p)
    }

    @Test fun olderPhonesUseStorageForRecorderFiles() {
        val p = perms(30, consented = true)
        assertTrue(Manifest.permission.READ_EXTERNAL_STORAGE in p)
        assertFalse(Manifest.permission.POST_NOTIFICATIONS in p)
    }

    @Test fun onlyMissingAndNotYetAskedAreRequested() {
        val wanted = AppPermissions.wanted(34, consented = true)
        val out = AppPermissions.toRequest(
            wanted,
            granted = setOf(Manifest.permission.CALL_PHONE),
            alreadyAsked = setOf(Manifest.permission.READ_CALL_LOG),
        )
        assertFalse(Manifest.permission.CALL_PHONE in out)
        assertFalse(Manifest.permission.READ_CALL_LOG in out)
        assertTrue(Manifest.permission.RECORD_AUDIO in out)
    }

    @Test fun nothingRequestedWhenAllGranted() {
        val wanted = AppPermissions.wanted(34, consented = true)
        assertEquals(emptyList<String>(), AppPermissions.toRequest(wanted, wanted.map { it.permission }.toSet(), emptySet()))
    }
}
