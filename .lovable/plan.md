# Older Preview and paid phone upgrade

## Version choices
- **Older Preview:** version from before October 29, 2026, 00:00 Dhaka; no new upgrade fee. Existing monthly maintenance rules remain unchanged.
- **Updated phone version:** today's development; selecting it opens its separate upgrade bill, and access unlocks only after authorized payment verification.
- Keep the exact older APK and release record intact. Identify the actual release/artifact before labelling it the pre-midnight version; timestamps alone must not invent an archived build.

## Build now, activate later
- Add a version-choice screen and an IT release preparation section showing the updated phone upgrade as **Price awaiting owner confirmation**.
- Keep new charging, payable invoice creation and paid upgrade distribution inactive while the amount is unset. Never display an invented price or treat the missing amount as zero.
- At the next go-live request, ask the owner for the final amount and currency, who pays (company or each user), and whether tax is included. Confirm the release attached to that bill before activating it.
- Preserve existing users, leads, reports, recordings, invoices and monthly maintenance access; choosing Preview does not bypass existing security checks.

## Technical details
- Use a separate upgrade entitlement and immutable bill/payment records, not the monthly maintenance invoice. Reuse the existing restricted payment-verification authority; submitting a reference or accepting a bill is not payment.
- Enforce access on the server for protected downloads and updated-phone requests; browser selection alone never unlocks anything. Keep recovery and queued old-version sync reachable without granting new-version work access.
- Preserve versioned APK storage rather than overwriting the old file. Reconcile the current publish/download filename mismatch as part of the versioned download path.
- Fail closed for unknown release, missing price and unverified payment. No live financial records or release changes during preparation.

## Verification
- Test old-version exemption from the new fee, exact Dhaka cutoff, missing-price refusal, payment-versus-approval distinction and user/release isolation.
- Run relevant tests and full regressions; inspect automatic application checks. Verify Preview selection and the pending-price screen without creating bills.
- Paid unlock and Android handset verification remain pending until pricing, payer scope and the final APK are confirmed. Do not publish during this preparation.