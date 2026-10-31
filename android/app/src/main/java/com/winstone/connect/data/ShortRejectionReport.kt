package com.winstone.connect.data

/** Mirrors the canonical server outcome defaults; server still validates every submit. */
data class ShortRejectionReport(val summary: String, val noFollowUpReason: String) {
    companion object {
        /** Mirrors the server: FAKE LEAD is only known from an answered call. */
        const val FAKE_NEEDS_ANSWERED_CALL =
            "কল ধরা না হলে FAKE LEAD দেওয়া যাবে না — কথা বলে নিশ্চিত হলে তবেই ভুয়া লিড দিন। কেউ না ধরলে NO ANSWER (ধরেনি) বাছাই করুন।"

        fun fakeNeedsAnsweredCall(category: String, received: Boolean): Boolean =
            category == "fake" && !received

        fun forCategory(category: String): ShortRejectionReport? = when (category) {
            "not_interested" -> ShortRejectionReport("Customer Not Interested", "not_interested")
            "wrong_number" -> ShortRejectionReport("Wrong Number", "wrong_number")
            // Keep the explicit fake category on the wire; the server maps its storage category.
            "fake" -> ShortRejectionReport("Fake / Invalid contact", "other")
            else -> null
        }
    }
}