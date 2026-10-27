# Android rules

- Android recordings fall back to the phone's own call-recorder file (PhoneRecordingPickupWorker, recorder_source=phone_recorder) through the same upload queue; no match = no upload — why: Android 10+ blocks app call-audio capture.
- android/whisper is GPL-3.0 code copied from NotelyVoice (owner decision 2026-10-24); any APK linking it must ship with its full source offered, and the module stays unlinked from :app until minSdk 26, model delivery and 16 kHz PCM conversion are decided — why: license obligation and app-size impact.
- An Android release counts as ready only when docs/ANDROID_RELEASE_READINESS.md records signature/ID/version and device evidence for every gate row — why: a green CI build is not handset proof.
