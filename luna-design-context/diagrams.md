# Luna Design-Facing Architecture & Workflow Diagrams

These diagrams provide Astra with clear visual maps of Luna's information architecture, data entity models, recording lifecycles, and lunar engine pipeline.

---

## 1. Information Architecture & Navigation Map

```mermaid
flowchart TD
    App["App Shell (src/App.jsx)"]
    
    subgraph Navigation ["Persistent Bottom Navigation"]
        TabSky["☽ Sky Tab"]
        TabLoops["◯ Loops Tab"]
        TabEchoes["◎ Echoes Tab (The Field)"]
        TabRhythm["〜 Rhythm Tab"]
        TabChat["✦ Chat Tab"]
    end
    
    subgraph SkySurfaces ["Sky Surfaces"]
        SkyMain["Sky Main View\n(MoonFace + Tide Bar + Zodiac)"]
        DeepSheet["Deep Cosmic Sheet\n(Exact windows, Season, Natal)"]
        ProfileDrawer["Profile & Settings Menu\n(Theme, Voice, Encryption, Export)"]
    end
    
    subgraph LoopSurfaces ["Loop Surfaces"]
        LoopsFeed["Loops View (Cycle & Phase)"]
        LoopSheet["Loop Creation Sheet"]
        RitualModal["New Moon Ritual Modal"]
        LoopDetail["Loop Subtasks & Linked Echoes"]
    end
    
    subgraph EchoSurfaces ["Echo Surfaces (The Field)"]
        EchoIdle["Idle Entrance\n(Prod Button Pair vs Codex EchoEntry)"]
        EchoComposer["Active Composer\n(Recording / Transcription / Editing)"]
        DraftBanner["Recovered Drafts Banner\n(Device-local Audio Recovery)"]
        EchoList["Chronological Echo Stream\n(Voice & Text Cards)"]
        VoiceQueue["Continuous Voice Playback Bar"]
    end
    
    subgraph ChatSurfaces ["Chat Surfaces"]
        ChatMain["Active Conversation Flow"]
        SessionDrawer["Chat Sessions History Drawer\n(Active vs Archived)"]
        VoicePlayback["Speech Synthesis\n(Nova / Nicole TTS Player)"]
    end

    App --> Navigation
    TabSky --> SkyMain
    SkyMain --> DeepSheet
    SkyMain --> ProfileDrawer
    
    TabLoops --> LoopsFeed
    LoopsFeed --> LoopSheet
    LoopsFeed --> RitualModal
    LoopsFeed --> LoopDetail
    
    TabEchoes --> EchoIdle
    EchoIdle --> EchoComposer
    TabEchoes --> DraftBanner
    TabEchoes --> EchoList
    EchoList --> VoiceQueue
    
    TabChat --> ChatMain
    ChatMain --> SessionDrawer
    ChatMain --> VoicePlayback
```

---

## 2. Personal Field Entity Relationship Model

```mermaid
erDiagram
    ECHO {
        string id PK "e_timestamp_random"
        string user_id FK
        string text "Spoken transcript or typed note"
        string source "voice | text | luna_conversation"
        string audio_path "Supabase Storage URL or null"
        string provenance_author "user | co-created"
        string provenance_kind "original_echo | conversation_reflection"
        string parent_id FK "Points to root echo if reflection"
        string phase "new | waxing-crescent | ..."
        string lunar_month "e.g. Hunter's, Sturgeon"
        float day_of_cycle "0.0 - 29.5"
        int illumination "0 - 100%"
        string zodiac "Zodiac sign of Moon"
        boolean is_encrypted "AES-GCM encrypted"
        string-array tags "User or thematic tags"
        string linked_loop_id FK
        string-array loop_ids
        timestamp created_at
    }

    LOOP {
        string id PK "l_timestamp_random"
        string user_id FK
        string title "Named intention or action"
        string type "cycle (29.5d) | phase (3.5d)"
        string status "active | closed | released"
        string color "Hex code accent"
        json subtasks "Array of {id, text, completed}"
        string phase_opened
        string lunar_month_opened
        string phase_closed
        timestamp opened_at
        timestamp closed_at
        string-array related_echo_ids FK
    }

    ECHO_REFLECTION {
        string id PK "ref_timestamp_random"
        string echo_id FK "Echo being reflected upon"
        string user_id FK
        string reflection_type "conversation | temporal_return"
        string content "AI/co-created synthesis"
        string author "Luna | user"
        timestamp created_at
    }

    CHAT_SESSION {
        string id PK "sess_timestamp_random"
        string user_id FK
        string title "Auto-derived or named conversation"
        boolean is_archived
        timestamp created_at
    }

    CHAT_MESSAGE {
        string id PK "msg_timestamp_random"
        string session_id FK
        string role "user | assistant"
        string content "Canonical response text"
        json citations "References to Echoes/Loops"
        timestamp created_at
    }

    ECHO ||--o{ LOOP : "attached_to"
    LOOP ||--o{ ECHO : "references_memories"
    ECHO ||--o{ ECHO_REFLECTION : "has_reflections"
    CHAT_SESSION ||--o{ CHAT_MESSAGE : "contains"
    CHAT_MESSAGE }o--o{ ECHO : "cites_as_grounded_evidence"
```

---

## 3. Echo Voice Recording & Resilient Draft Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Person as User
    participant UI as EchoEntry / Echoes Tab
    participant IDB as Local IndexedDB (luna_audio_drafts)
    participant Whisper as Transformers.js (Local Client)
    participant Cloud as Supabase Storage & DB

    Person->>UI: Tap "Begin speaking"
    UI->>UI: Request microphone stream
    Note over UI: Button enters "Opening microphone…" (debounced)
    UI->>UI: MediaRecorder starts (audio/webm;codecs=opus)
    Person->>UI: Speaks thought / memory
    Person->>UI: Tap "STOP RECORDING"
    UI->>IDB: 1. SAVE DRAFT AUDIO IMMEDIATELY (blob, metadata, status: 'draft')
    Note over IDB: Audio is safely on device even if tab is closed
    UI->>Whisper: 2. Run local transcription (WASM / WebGPU)
    Whisper-->>UI: Return transcript text
    UI->>IDB: Update draft with transcript text
    UI->>UI: Open review composer (audio preview + editable text)
    Person->>UI: Tap "ECHO ↩" (Save)
    UI->>IDB: Update draft status: 'saving'
    UI->>Cloud: Upload audio blob to storage
    alt Upload Succeeded
        Cloud-->>UI: Return storage path
        UI->>Cloud: Insert Echo row in Supabase
        Cloud-->>UI: Confirmed Echo saved
        UI->>IDB: Update status: 'synced' -> deleteDraftAudio()
        UI->>UI: Add Echo to stream, clear composer
    else Network / Upload Failed
        Cloud--xUI: Upload failed
        UI->>IDB: Update draft status: 'failed'
        UI->>Person: Alert: "Audio saved safely on device. You can retry anytime."
        UI->>UI: Render in "Recovered Drafts" banner
    end
```

---

## 4. Lunar Engine & Phase Pipeline

```mermaid
flowchart LR
    Clock["Current UTC Date"] --> Julian["toJulianDate()"]
    Julian --> Ephemeris["Jean Meeus Moon Ephemeris\n(Orbital perturbations, Sun/Moon Longitudes)"]
    Ephemeris --> Elongation["Moon Elongation (0° - 360°)"]
    
    Elongation --> MoonAge["getMoonAge()\n(0 to 29.53058867 Synodic Days)"]
    Elongation --> Illum["getIllumination()\n(0% to 100%)"]
    Elongation --> Zodiac["Moon Zodiac Sign (30° segments)"]
    
    MoonAge --> PhaseClassifier{"Phase Classifier"}
    PhaseClassifier -->|0 - 0.925d| New["New Moon (Threshold)"]
    PhaseClassifier -->|0.925 - 6.458d| WaxCresc["Waxing Crescent (Flow)"]
    PhaseClassifier -->|6.458 - 8.308d| FirstQ["First Quarter (Threshold)"]
    PhaseClassifier -->|8.308 - 13.840d| WaxGibb["Waxing Gibbous (Flow)"]
    PhaseClassifier -->|13.840 - 15.690d| Full["Full Moon (Threshold)"]
    PhaseClassifier -->|15.690 - 21.223d| WanGibb["Waning Gibbous (Flow)"]
    PhaseClassifier -->|21.223 - 23.073d| LastQ["Last Quarter (Threshold)"]
    PhaseClassifier -->|23.073 - 28.605d| WanCresc["Waning Crescent (Flow)"]

    PhaseClassifier --> TideClassifier{"Phase Progress (0.0 to 1.0)"}
    TideClassifier -->|< 0.20| TideOpen["opening"]
    TideClassifier -->|0.20 - 0.62| TideFlow["flowing"]
    TideClassifier -->|0.62 - 0.88| TideComp["completing"]
    TideClassifier -->|>= 0.88| TideClose["closing"]
```
