package com.winstone.connect.data

/** Mirrors the canonical server outcome defaults; server still validates every submit. */
data class ShortRejectionReport(val summary: String, val noFollowUpReason: String) {
    companion object {
        fun forCategory(category: String): ShortRejectionReport? = when (category) {
            "not_interested" -> ShortRejectionReport("Customer Not Interested", "not_interested")
            "wrong_number" -> ShortRejectionReport("Wrong Number", "wrong_number")
            // Keep the explicit fake category on the wire; the server maps its storage category.
            "fake" -> ShortRejectionReport("Fake / Invalid contact", "other")
            else -> null
        }
    }
}