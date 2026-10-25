# Polish the existing login page

Visual-only refresh of `/auth`. Sign-in, sign-up, password rules, redirects and the must-change-password flow stay exactly as they are.

## What changes
- **Left brand panel (desktop):** ivory/champagne surface with a soft gold accent line, the Winstone Pulse wordmark, the "PULSE — Find. Build. Invest." tagline, and a small live-style preview card (booking status / today's leads) inspired by the uploaded dashboard slide — static, no real data.
- **Form card:** a framed card with a subtle shadow, larger heading, clearer helper text, fields with left icons (ID / password), show/hide password toggle, and a full-width black primary button with a loading state.
- **Small touches:** visible focus rings, inline Bengali/English error text under the button, a "Forgot password?" link to the existing reset page, and a cleaner footer.
- **Phone:** compact brand header above the card, comfortable tap sizes, no sideways scrolling.

## Kept as-is
- Brand palette, Inter + Caveat fonts, Bengali-first text with the language switch.
- All login logic and account checks.
- HubSpot clone and UI-extension uploads used only as layout reference; no code copied in.

## Technical details
- Edit only `src/routes/auth.tsx` (plus any new tokens in `src/styles.css`); semantic tokens only, no hardcoded colors.
- New strings added as `{ bn, en }` pairs.
- Verify with a browser screenshot at desktop and phone widths, and confirm the build passes.
