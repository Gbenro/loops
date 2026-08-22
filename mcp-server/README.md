# Luna Loop MCP Server

> *Conversation is where awareness can unfold. Luna Loop is where what deserves to remain is consciously carried forward.*

Luna Loop MCP (Model Context Protocol) is an open-protocol gateway that exposes Luna Loop as a primary source of truth for conversational AI models. By connecting Claude, ChatGPT, or local agents to this server, the AI ceases to be a generic task manager and becomes a cyclical reflection companion capable of observing and modifying your Loops, Echoes, and Lunar context under strict user data isolation.

## Core Ontology

Luna Loop concepts are strictly defined and must not be conflated with traditional productivity workflows:
1. **Loop**: A Loop is *not* a task. It is an item consciously retained in awareness. It represents a creative focus, an intention, or a question the user chooses to hold in mind. It supports a full lifecycle of states: `open`, `completed`, `released`, `carried_forward`, and `transformed`.
2. **Echo / Entry**: An Echo is a reflection note capturing energetic states, realignments, or shifts in consciousness. Every Echo is stamped with the user's current moon phase, zodiac position, cycle day, and illumination percentage.
3. **get_ai_context**: A lightweight summary endpoint designed so AI models can understand where the user stands in their current cycle immediately without needing to read their entire history, minimizing latency and token overhead.

---

## Technical Specifications

### OAuth Scopes
The server implements granular authorization with OAuth 2.0. Recommended scopes:
- `cycles:read`
- `loops:read`
- `loops:write`
- `echoes:read`
- `echoes:write`
- `entries:read`
- `entries:write`
- `profile:read`

### Exposed Tools
* **get_current_lunar_context**: Detailed current lunar calculations.
* **get_current_cycle**: Information about the active lunar month.
* **get_phase_summary**: List entries and loops opened/closed during a specific moon phase.
* **list_open_loops**: Fetch active/open loops.
* **get_loop**: Fetch detailed single loop.
* **search_loops**: Search loop titles and notes (designed for vector search compatibility).
* **create_loop**: Create a new loop stamped with current lunar metadata.
* **update_loop**: Modify loops or transition their state.
* **complete_loop**: Mark loop as resolved.
* **release_loop**: Deliberately let go of a loop.
* **carry_loop_forward**: Transition a loop to the next cycle and link a new loop to the parent.
* **create_echo** (alias `create_entry`): Record a reflection stamped with current lunar data.
* **get_echo** (alias `get_entry`): Read a specific reflection.
* **search_echoes** (alias `search_entries`): Keyword-search reflections.
* **get_cycle_entries**: Retrieve all entries for a specific lunar month.
* **get_cycle_summary**: Compile statistics for an entire completed cycle.
* **search_cycles**: Find cycles matching keywords.
* **get_ai_context**: Lightweight active state snapshot.

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   cd mcp-server
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in `mcp-server/` with the following variables:
   ```env
   PORT=3001
   SUPABASE_URL=https://eyxvsbqyzeodsjajfqsj.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Database Migration**:
   Ensure that the SQL commands in `supabase/migrations/20260821000001_mcp_metadata.sql` have been run on your Supabase instance to add metadata tracking.

4. **Run Server**:
   ```bash
   # Dev Mode
   npm run dev

   # Production Build & Run
   npm run build
   npm start
   ```

---

## Client Integration

### Claude Desktop Configuration
Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luna-loop": {
      "command": "node",
      "args": ["/absolute/path/to/loops-app/mcp-server/dist/server.js"],
      "env": {
        "SUPABASE_URL": "https://eyxvsbqyzeodsjajfqsj.supabase.co",
        "SUPABASE_ANON_KEY": "your_supabase_anon_key"
      }
    }
  }
}
```

### Remote client connecting via SSE
The client connects to `http://localhost:3001/sse` and passes a valid Supabase JWT Bearer token in the `Authorization` header. It then receives SSE events and sends JSON-RPC POST requests to `/messages`.
