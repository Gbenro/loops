# Luna Existing Capabilities (Production Truth)

This document catalogs what is **actually working and deployed** in Luna today.

---

## 1. Personal Field & Echoes
* **Original Voice Recording**: Browser MediaRecorder captures raw microphone audio in `audio/webm;codecs=opus` (with MP4 fallback).
* **Local Whisper Transcription**: Client-side Transformers.js runs Whisper WebAssembly/WebGPU locally without sending audio to third-party APIs unless fallback is triggered.
* **Resilient Device Drafts**: Unsynced voice recordings and text drafts are stored in IndexedDB (`luna_audio_drafts`). If the user goes offline, closes the app, or upload fails, the audio is preserved and surfaced via the "Recovered Drafts" banner with **Listen**, **Resume**, **Retry Sync**, and **Discard** options.
* **Voice Playback Queue**: Sequential autoplay queue for all voice Echoes in the current filtered stream.
* **End-to-End Client Encryption**: Optional user passphrase encrypts Echo text locally using AES-GCM before saving to Supabase (`src/lib/encryption.js`).
* **Bidirectional Loop Attachment**: Echoes can be attached to one or multiple Loops; updating an Echo updates `relatedEchoIds` on the Loop, and vice-versa.

---

## 2. Astronomical & Lunar Engine
* **Astronomical Calculations**: Jean Meeus Moon Ephemeris computes true solar/lunar longitudes, elongation angle, and exact synodic age (0 to 29.53 days).
* **8 Symmetric Lunar Phases**: 4 Threshold phases (New, First Quarter, Full, Last Quarter — 1.85 days duration) and 4 Flow phases (Waxing Crescent, Waxing Gibbous, Waning Gibbous, Waning Crescent — 5.55 days duration).
* **Phase Tides**: Four distinct energy tide segments per phase (`opening`, `flowing`, `completing`, `closing`).
* **12 Traditional Lunar Cycles**: Wolf, Snow, Worm, Pink, Flower, Strawberry, Buck, Sturgeon, Harvest, Hunter's, Beaver, Cold (with Southern Hemisphere inversion options).
* **Zodiac Tracking**: Real-time astrological calculation of Moon and Sun zodiac signs.

---

## 3. Loops (Commitments in Time)
* **Cycle Loops**: 29.5-day intentional containers pre-populated with 8 phase checkpoints.
* **Phase Loops**: 3.5-day action windows that automatically close or prompt for release at phase transitions.
* **Circular Progress Rings**: SVG progress rings visualizing subtask completion ratios.
* **New Moon Ritual**: Ceremonial intention modal accessible during the New Moon threshold window.

---

## 4. Chat with Luna
* **Attention Engine (V1/V2)**: Retrieval-augmented conversational engine that pulls relevant historical Echoes, Loops, and Reflections into context.
* **Grounded Field Citations**: Responses include explicit brackets linking to source memories (e.g. `[Ref: Hunter's Waxing Crescent]`).
* **Speech Synthesis (Nova / Nicole)**: Text-to-speech rendering using ElevenLabs with chunking for immediate speech start.
* **Session Archiving**: Grouping of conversations into active vs archived sessions.
