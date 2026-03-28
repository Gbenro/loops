# Voice Recording UX Improvements

**Issue:** LUN-31 — Improve voice recording feedback and discoverability
**Date:** 2026-03-28
**Author:** UX Designer Agent

---

## Current State Analysis

### What's Working
- Voice orb button with clear recording/transcribing states
- ARIA labels for accessibility (`aria-label`, `aria-pressed`)
- Pulsing animation during recording
- Recording timer displayed
- Phase-specific voice prompts

### Issues to Address

| Issue | Impact | Priority |
|-------|--------|----------|
| No waveform visualization | Users unsure if mic is working | P2 |
| No confirmation before discard | Lost recordings on accidental cancel | P2 |
| Recording indicator could be larger | Easy to miss recording state | P2 |
| No audio level feedback | Users unsure of volume | P3 |

---

## Design Specifications

### 1. Audio Waveform Visualization

Add a simple waveform display during recording to provide real-time feedback.

#### Visual Concept
```
While recording, display 5 animated bars above the textarea:

     ▁   ▃   █   ▅   ▂
     │   │   │   │   │
    bar1 bar2 bar3 bar4 bar5
```

#### Specifications
```css
.waveform-bar {
  width: 4px;
  border-radius: 2px;
  background: #FC8181; /* Recording red */
  transition: height 0.1s ease-out;
}

/* Bar heights driven by audio level (0-100%) */
.waveform-container {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  height: 24px;
}
```

#### Implementation Notes
- Use Web Audio API's `AnalyserNode` to get frequency data
- Sample at ~60fps for smooth animation
- Map frequency bins to 5 bars (low to high freq)
- Scale heights: min 4px, max 24px
- When idle: all bars at 4px

### 2. Enhanced Recording Indicator

Make the recording state more prominent.

#### Current
- Voice orb turns pink with ripple
- Timer appears above

#### Proposed Additions
1. **Full-width recording bar** at top of composition area
2. **Stronger color pulse** on the composition border
3. **Haptic feedback** on native (start/stop)

```
┌──────────────────────────────────────────────────────────┐
│ ● RECORDING  0:15                        [CANCEL]        │  ← New bar
├──────────────────────────────────────────────────────────┤
│                                                          │
│          [Waveform visualization here]                   │
│                                                          │
│     ┌────────────────────────────────────────────┐      │
│     │ "What is being revealed?"                   │      │
│     │                                             │      │
│     │                                             │      │
│     └────────────────────────────────────────────┘      │
│                                                          │
│      [CANCEL]                              ◎  [ECHO]     │
│                                            ↑             │
│                                         Voice orb        │
└──────────────────────────────────────────────────────────┘
```

#### Recording Bar Specs
```css
.recording-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(252, 129, 129, 0.08);
  border-radius: 8px;
  margin-bottom: 12px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FC8181;
  animation: recording-pulse 1s ease-in-out infinite;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 3. Discard Confirmation

Add confirmation when canceling a recording that has content.

#### Trigger Conditions
- User taps "Cancel" while recording OR
- User taps "Cancel" after recording with pending audio

#### Confirmation Dialog
```
┌─────────────────────────────────────────┐
│                                         │
│   Discard this recording?               │
│                                         │
│   The audio and any transcription       │
│   will be lost.                         │
│                                         │
│   ┌─────────────┐  ┌─────────────────┐ │
│   │   DISCARD   │  │ KEEP RECORDING  │ │
│   └─────────────┘  └─────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

#### Specifications
- Simple inline confirmation (not modal)
- Replace cancel button with two options temporarily
- Auto-dismiss after 5 seconds (keeps recording)
- "Discard" is destructive red, "Keep" is neutral

### 4. Audio Level Indicator (Optional P3)

For users who want volume feedback without full waveform.

#### Simple Meter
```
Volume level shown as single bar beneath orb:

       ◎
   ┌──────┐
   │████  │  ← Level meter (0-100%)
   └──────┘
```

#### Specifications
```css
.level-meter {
  width: 40px;
  height: 3px;
  background: rgba(245, 230, 200, 0.1);
  border-radius: 1.5px;
  margin-top: 6px;
  overflow: hidden;
}

.level-meter-fill {
  height: 100%;
  background: #FC8181;
  border-radius: 1.5px;
  transition: width 0.1s ease-out;
}
```

---

## States Summary

### Idle (Not Writing)
- Voice orb visible in FAB area
- Subtle idle animation
- Label: "Start voice recording"

### Writing Mode (Text)
- Textarea focused
- Voice orb visible as secondary action
- Cancel/Save buttons

### Recording
- **NEW:** Recording bar with timer at top
- **NEW:** Waveform visualization
- Voice orb shows stop icon (■) with red glow
- Ripple animation on orb
- Textarea shows phase prompt
- "STOP FIRST" on save button

### Transcribing
- Voice orb shows "..."
- Purple loading state
- Progress indicator for Whisper model
- Textarea readonly
- "WAIT..." on save button

### Audio Ready
- **NEW:** Audio waveform thumbnail (static)
- "VOICE" badge showing
- Transcript in textarea (editable)
- Save enabled

---

## Accessibility

1. **Screen reader announcements:**
   - "Recording started"
   - "Recording stopped, 15 seconds captured"
   - "Transcribing audio"
   - "Transcription complete"

2. **Keyboard shortcuts:**
   - Space bar to start/stop when orb focused
   - Escape to cancel (with confirmation if content exists)

3. **Reduced motion:**
   - Disable waveform animation
   - Use simple opacity change for recording indicator

---

## Implementation Tasks

### P2 - This Sprint
1. [ ] Add waveform visualization component using Web Audio API
2. [ ] Add recording bar with prominent timer
3. [ ] Add discard confirmation for recordings with content
4. [ ] Add screen reader announcements for state changes

### P3 - Backlog
5. [ ] Add audio level meter (simpler alternative to waveform)
6. [ ] Add haptic feedback on native platforms
7. [ ] Add audio preview before saving

---

## Technical Notes

### Web Audio API for Waveform
```javascript
// In startRecording():
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 32; // Small for 5 bars

const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

// Read frequency data
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
// Map dataArray values to bar heights
```

### Haptics (Capacitor)
```javascript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// On recording start
Haptics.impact({ style: ImpactStyle.Medium });

// On recording stop
Haptics.impact({ style: ImpactStyle.Light });
```

---

## Effort Estimate

| Task | Effort |
|------|--------|
| Waveform component | 3-4 hours |
| Recording bar UI | 1-2 hours |
| Discard confirmation | 1-2 hours |
| Screen reader updates | 1 hour |
| **Total** | **6-9 hours** |

---

*Document created: 2026-03-28*
*Author: UX Designer Agent*
