# Luna Design & Architectural Constraints

For Astra and the implementation team: these constraints protect user privacy, historical record integrity, and device performance.

---

## 1. Immutability of Original Experience
* **Rule**: Historical user-authored Echoes (`provenanceAuthor: 'user'`, `provenanceKind: 'original_echo'`) are immutable historical records.
* **Implication**:
  - The UI must never silently overwrite or re-interpret what a person recorded.
  - AI reflections, syntheses, or summaries must always be explicitly demarcated with separate provenance (`provenanceAuthor: 'co-created'`).
  - Editing an Echo's text after recording is treated as correcting a transcript, not altering the original audio artifact.

---

## 2. Privacy & Zero-Knowledge Storage
* **Rule**: The personal Field belongs exclusively to the user.
* **Implication**:
  - Echo text can be encrypted client-side with AES-GCM using the user's passphrase.
  - When encrypted, the server only holds ciphertext. The UI must handle locked/unlocked states gracefully.
  - Audio recordings must never be processed by external transcription services unless explicitly configured.

---

## 3. Device Resilience (Offline & Interruption Durability)
* **Rule**: A spoken thought is fragile. If a recording is interrupted or network drops, the audio must never be lost.
* **Implication**:
  - Audio blobs are saved to IndexedDB immediately upon stopping the recorder, before transcription or network upload begins.
  - The UI must always provide a visible recovery path for unsynced drafts.

---

## 4. Responsive & Native Boundaries
* **Target Platforms**: Mobile Web (PWA), Android (Capacitor), and Desktop Web.
* **Implication**:
  - Primary target is narrow mobile viewport (390px to 460px).
  - All interactive buttons must have a minimum touch target of 48px.
  - Desktop view must remain a focused, calm column (max-width 520px for tab views) rather than stretching full-width.
