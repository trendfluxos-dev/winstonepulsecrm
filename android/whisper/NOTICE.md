# On-device speech-to-text engine (from NotelyVoice)

This module is copied unchanged from NotelyVoice (https://github.com/tosinonikute/NotelyVoice),
which bundles whisper.cpp / ggml. NotelyVoice is licensed under GPL-3.0 (see LICENSE-GPL-3.0.md).

Because the Winstone Connect Android app includes this code, any APK that links this module
is a GPL-3.0 work: its complete source code must be offered to everyone who receives the APK.

Status: included in the Gradle build as a separate module (`:whisper`); not yet linked into `:app`.
Linking it requires raising the app's minSdk from 24 to 26, bundling or downloading a Whisper model
file (ggml-base ~148 MB / ggml-tiny ~78 MB), and converting recordings to 16 kHz mono PCM.
