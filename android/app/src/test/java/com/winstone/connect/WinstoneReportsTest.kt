package com.winstone.connect

import com.winstone.connect.data.remote.WinstoneReports
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class WinstoneReportsTest {
    @Test fun urlCarriesOnlyValidDatesAndNoIdentity() {
        val url = WinstoneReports.buildUrl("https://crm.winstonebd.com", "2026-10-01", "bad")
        assertEquals("https://crm.winstonebd.com/api/public/reports/summary?from=2026-10-01", url)
        assertFalse(url.contains("employee_id"))
    }

    @Test fun authStatusesAreClassified() {
        assertEquals(WinstoneReports.Result.SignedOut, WinstoneReports.classify(401))
        assertEquals(WinstoneReports.Result.Forbidden, WinstoneReports.classify(403))
        assertNull(WinstoneReports.classify(200))
    }
}
