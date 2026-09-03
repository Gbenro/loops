import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import WebSocket from 'ws';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getUserIdFromToken, getSupabaseForUser } from './db.js';
import { executeTool, TOOL_DEFINITIONS_COMPAT } from './tools.js';
import { registerChatRoutes } from './chat.js';
import { registerDevBridgeRoutes } from './devBridge.js';
import { getLunarData } from './lunar.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

// ─── OAuth 2.0 Memory Store ──────────────────────────────────────────────────

interface OauthSession {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  expiresAt: number;
}

interface UserTokenStore {
  supabaseAccessToken: string;
  supabaseRefreshToken: string;
  scopes: string[];
}

const authCodes = new Map<string, { userId: string; session: OauthSession; tokens: UserTokenStore }>();
const refreshTokens = new Map<string, { userId: string; tokens: UserTokenStore }>();
const oauthSessions = new Map<string, OauthSession>();

// Active user MCP sessions
const activeSessions = new Map<string, {
  transport: SSEServerTransport;
  supabaseToken: string;
  scopes: string[];
}>();

// ─── OAuth Routes ────────────────────────────────────────────────────────────

// 1. Authorize endpoint
app.get('/oauth/authorize', (req, res) => {
  console.log('[OAuth Authorize Query Callback Received]:', req.query);
  const { client_id, redirect_uri, response_type, state, scope } = req.query;

  if (!client_id || !redirect_uri || !state) {
    console.error('[OAuth Error] Missing parameter. client_id:', client_id, 'redirect_uri:', redirect_uri, 'state:', state);
    res.status(400).send(`Missing required OAuth parameters: client_id, redirect_uri, or state. Received query parameters: ${JSON.stringify(req.query)}`);
    return;
  }

  // Store OAuth request context in memory
  const sessionId = Math.random().toString(36).substr(2, 9);
  oauthSessions.set(sessionId, {
    clientId: client_id as string,
    redirectUri: redirect_uri as string,
    state: state as string,
    scope: (scope as string) || 'loops:read loops:write echoes:read echoes:write profile:read',
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 min expiry
  });

  // Redirect to login form
  res.redirect(`/login?sessionId=${sessionId}`);
});

// 2. Login Page HTML & Script
app.get('/login', (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId || !oauthSessions.has(sessionId)) {
    res.status(400).send('Invalid or expired OAuth session.');
    return;
  }

  const session = oauthSessions.get(sessionId)!;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Luna Loop - Authenticate</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #040810;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: #080d1a;
          border: 1px solid rgba(245, 230, 200, 0.2);
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          maxWidth: 380px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          text-align: center;
        }
        h2 {
          font-family: serif;
          font-size: 26px;
          margin-bottom: 8px;
        }
        .subtitle {
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          margin-bottom: 24px;
        }
        input {
          width: 100%;
          padding: 12px;
          background: rgba(245, 230, 200, 0.08);
          border: 1px solid rgba(245, 230, 200, 0.2);
          border-radius: 8px;
          color: white;
          box-sizing: border-box;
          margin-bottom: 16px;
          font-size: 14px;
        }
        button {
          width: 100%;
          padding: 12px;
          background: rgba(167, 139, 250, 0.2);
          border: 1px solid #c4b5fd;
          border-radius: 8px;
          color: #c4b5fd;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
          transition: 0.2s;
        }
        button:hover {
          background: rgba(167, 139, 250, 0.3);
        }
        .scopes {
          text-align: left;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.02);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .error {
          color: #ff8888;
          font-size: 13px;
          margin-top: 12px;
        }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.8/dist/umd/supabase.js"></script>
    </head>
    <body>
      <div class="container">
        <h2>Authenticate Luna Loop</h2>
        <div class="subtitle">Grant permission to your AI companion</div>
        
        <div class="scopes">
          <strong>Requesting permissions:</strong>
          <div style="margin-top: 6px;">${session.scope.split(' ').map(s => `• ${s}`).join('<br/>')}</div>
        </div>

        <form id="loginForm">
          <input type="email" id="email" placeholder="Email" required />
          <input type="password" id="password" placeholder="Password" required />
          <button type="submit" id="btn">Approve Access</button>
          <div class="error" id="error"></div>
        </form>
      </div>

      <script>
        const supabaseUrl = '${process.env.SUPABASE_URL || 'https://eyxvsbqyzeodsjajfqsj.supabase.co'}';
        const supabaseAnonKey = '${process.env.SUPABASE_ANON_KEY || 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr'}';
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          const errorDiv = document.getElementById('error');
          const btn = document.getElementById('btn');
          
          errorDiv.innerText = '';
          btn.innerText = 'Authorizing...';
          btn.disabled = true;

          try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
              errorDiv.innerText = error.message;
              btn.innerText = 'Approve Access';
              btn.disabled = false;
              return;
            }

            // Send tokens to our server callback
            const response = await fetch('/login/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: '${sessionId}',
                supabaseAccessToken: data.session.access_token,
                supabaseRefreshToken: data.session.refresh_token
              })
            });

            const result = await response.json();
            if (result.redirectUrl) {
              window.location.href = result.redirectUrl;
            } else {
              errorDiv.innerText = 'Authorization failed on server.';
              btn.innerText = 'Approve Access';
              btn.disabled = false;
            }
          } catch (err) {
            errorDiv.innerText = 'An error occurred: ' + err.message;
            btn.innerText = 'Approve Access';
            btn.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 3. Login callback endpoint
app.post('/login/callback', async (req, res) => {
  const { sessionId, supabaseAccessToken, supabaseRefreshToken } = req.body;

  if (!sessionId || !supabaseAccessToken) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  const session = oauthSessions.get(sessionId);
  if (!session) {
    res.status(400).json({ error: 'OAuth session expired' });
    return;
  }

  // Get user ID from Supabase token
  const userId = await getUserIdFromToken(supabaseAccessToken);
  if (!userId) {
    res.status(401).json({ error: 'Invalid user credentials' });
    return;
  }

  // Generate Authorization Code
  const code = 'ac_' + Math.random().toString(36).substr(2, 12);
  authCodes.set(code, {
    userId,
    session,
    tokens: {
      supabaseAccessToken,
      supabaseRefreshToken: supabaseRefreshToken || '',
      scopes: session.scope.split(' ')
    }
  });

  // Cleanup session
  oauthSessions.delete(sessionId);

  // Return redirect URL to frontend
  const redirectUrl = `${session.redirectUri}?code=${code}&state=${session.state}`;
  res.json({ redirectUrl });
});

// 4. Token exchange endpoint
app.post('/oauth/token', async (req, res) => {
  const { grant_type, code, refresh_token } = req.body;

  if (grant_type === 'authorization_code') {
    if (!code) {
      res.status(400).json({ error: 'invalid_request', error_description: 'Missing code' });
      return;
    }

    const authData = authCodes.get(code);
    if (!authData) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
      return;
    }

    // Clean up used authorization code
    authCodes.delete(code);

    res.json({
      access_token: authData.tokens.supabaseAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: authData.tokens.supabaseRefreshToken, // return actual Supabase refresh token
      scope: authData.session.scope
    });
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh token' });
      return;
    }

    try {
      // Create a stateless client to exchange the refresh token with Supabase Auth API
      const client = getSupabaseForUser(refresh_token);
      const { data, error } = await client.auth.refreshSession({ refresh_token });

      if (error || !data.session) {
        console.error('Supabase token refresh failed:', error?.message);
        res.status(400).json({ error: 'invalid_grant', error_description: error?.message || 'Invalid refresh token' });
        return;
      }

      res.json({
        access_token: data.session.access_token,
        token_type: 'Bearer',
        expires_in: data.session.expires_in || 3600,
        refresh_token: data.session.refresh_token, // return new Supabase refresh token
        scope: 'cycles:read loops:read loops:write echoes:read echoes:write profile:read'
      });
    } catch (err: any) {
      console.error('Error during stateless token refresh:', err);
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  } else {
    res.status(400).json({ error: 'unsupported_grant_type' });
  }
});

// ─── Scope Permissions Helper ────────────────────────────────────────────────

function checkScope(scopes: string[], toolName: string): boolean {
  // Loops read tools
  if (toolName === 'list_loops' || toolName === 'list_open_loops' || toolName === 'get_loop' || toolName === 'search_loops') {
    return scopes.includes('loops:read');
  }
  // Loops write tools
  if (toolName === 'create_loop' || toolName === 'update_loop' || toolName === 'close_loop' || toolName === 'reopen_loop' || toolName === 'archive_loop' || toolName === 'restore_loop' || toolName === 'carry_loop_forward') {
    return scopes.includes('loops:write');
  }
  // Echoes write tools
  if (toolName === 'create_echo' || toolName === 'create_entry' || toolName === 'update_echo' || toolName === 'archive_echo' || toolName === 'restore_echo' || toolName === 'create_thread' || toolName === 'update_thread' || toolName === 'connect_echo_to_thread' || toolName === 'disconnect_echo_from_thread' || toolName === 'attach_reflection') {
    return scopes.includes('echoes:write') || scopes.includes('entries:write');
  }
  // Echoes read tools
  if (toolName === 'get_echo' || toolName === 'get_entry' || toolName === 'search_echoes' || toolName === 'search_entries' || toolName === 'get_cycle_entries' || toolName === 'list_threads' || toolName === 'get_thread' || toolName === 'get_echo_reflections') {
    return scopes.includes('echoes:read') || scopes.includes('entries:read');
  }
  // Cycle / context read tools
  if (toolName === 'get_current_lunar_context' || toolName === 'get_current_cycle' || toolName === 'get_phase_summary' || toolName === 'get_cycle_summary' || toolName === 'search_cycles') {
    return scopes.includes('cycles:read');
  }
  // Cross-object search (requires both)
  if (toolName === 'search_luna') {
    return scopes.includes('loops:read') && (scopes.includes('echoes:read') || scopes.includes('entries:read'));
  }
  // Lightweight AI Context (requires both)
  if (toolName === 'get_ai_context') {
    return scopes.includes('loops:read') && (scopes.includes('echoes:read') || scopes.includes('entries:read'));
  }
  return false;
}

// ─── MCP SSE Connections ─────────────────────────────────────────────────────

// SSE connection setup
app.get('/sse', async (req, res) => {
  // Retrieve token from Authorization header or query param
  const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).send('Unauthorized: Missing Supabase Access Token.');
    return;
  }

  // Validate token
  const userId = await getUserIdFromToken(token);
  if (!userId) {
    res.status(401).send('Unauthorized: Invalid or expired access token.');
    return;
  }

  // Scopes defaults to all if not explicitly managed by client OAuth configuration
  const scopes = (req.query.scopes as string)?.split(' ') || [
    'cycles:read', 'loops:read', 'loops:write', 'echoes:read', 'echoes:write', 'entries:read', 'entries:write', 'profile:read'
  ];

  console.log(`User connected to MCP: ${userId} with scopes [${scopes.join(', ')}]`);

  // Establish SSE transport
  const transport = new SSEServerTransport('/messages', res);
  const supabase = getSupabaseForUser(token);

  // Initialize a separate isolated Server instance per connection session
  const server = new Server(
    { name: 'luna-loops-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  // 1. Tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS_COMPAT };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // Check granular scope permission
    if (!checkScope(scopes, name)) {
      return {
        content: [{ type: 'text', text: `Permission Denied: This client lacks the required scope to execute tool "${name}".` }],
        isError: true
      };
    }

    try {
      const result = await executeTool(supabase, name, args || {});
      return result;
    } catch (err: any) {
      console.error(`Tool execution error [${name}]:`, err);
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  });

  // 2. Resources handler (Expose Luna Loops Ontology descriptions)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'luna-loops://ontology/loop',
          name: 'Ontology: What is a Loop?',
          description: 'Philosophical and behavioral guidelines explaining loops.',
          mimeType: 'text/markdown'
        },
        {
          uri: 'luna-loops://ontology/echo',
          name: 'Ontology: What is an Echo?',
          description: 'Philosophical definition of Echoes and Reflections.',
          mimeType: 'text/markdown'
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri === 'luna-loops://ontology/loop') {
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: `
# Ontology: Loop

In Luna Loop, a **Loop is NOT a task** or a generic todo list item.

* **Definition**: A Loop is an item consciously retained in awareness. It represents an intention, a question, or a creative focus that the user chooses to hold in mind.
* **Lifecycle**:
  * **Open**: The loop is active and occupies mental space.
  * **Completed**: The focus has been resolved.
  * **Released**: The loop is consciously let go, recognizing that it is no longer serving a purpose.
  * **Carried Forward**: The loop is transitioned into the next cycle or moon phase, adapting its shape.
  * **Transformed**: The loop evolved into a new focus.
          `.trim()
        }]
      };
    } else if (uri === 'luna-loops://ontology/echo') {
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: `
# Ontology: Echo / Journal Entry

In Luna Loop, an **Echo is a reflection or a moment of awareness**.

* **Definition**: Echoes capture observations, shifts in energy, dreams, intentions, or realizations.
* **Lunar stamping**: Every Echo is stamped with the current lunar month (the moon), lunar phase, zodiac alignment, cycle day, and illumination, serving as a map of the user's emotional and physical state.
          `.trim()
        }]
      };
    } else {
      throw new Error(`Resource not found: ${uri}`);
    }
  });

  await server.connect(transport);

  const sessionId = transport.sessionId;
  activeSessions.set(sessionId, { transport, supabaseToken: token, scopes });

  req.on('close', () => {
    console.log(`User disconnected from MCP session: ${sessionId}`);
    activeSessions.delete(sessionId);
  });
});

// Messages post route
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }

  await session.transport.handlePostMessage(req, res);
});

// ─── Status check endpoint ───────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Luna Loop MCP Server</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #040810;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: #080d1a;
          border: 1px solid rgba(245, 230, 200, 0.2);
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          text-align: center;
        }
        h1 {
          font-family: serif;
          font-size: 28px;
          margin-bottom: 12px;
          color: #f5e6c8;
        }
        p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 24px;
          font-style: italic;
        }
        .status {
          display: inline-block;
          padding: 6px 12px;
          background: rgba(167, 139, 250, 0.15);
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 20px;
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Luna Loop MCP Server</h1>
        <p>"Conversation is where awareness can unfold. Luna Loop is where what deserves to remain is consciously carried forward."</p>
        <div class="status">● Server Online & Active</div>
      </div>
    </body>
    </html>
  `);
});

// ─── REST API Fallback (for Custom GPT Actions) ────────────────────────────────

import { validateDevSessionToken, validateDevDiscoveryToken } from './devBridge.js';
import { getSupabaseAnon, getSupabaseService } from './db.js';

const authenticateRest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  // 1. Scoped Discovery Credential (dsc_...)
  if (token.startsWith('dsc_') || token === process.env.LUNA_DEV_DISCOVERY_KEY) {
    const discovery = await validateDevDiscoveryToken(token);
    if (!discovery) {
      res.status(401).json({ error: 'Invalid or rejected Discovery Token' });
      return;
    }

    // Strict boundary: Discovery credentials have ZERO Personal Field access
    const isPersonalField = req.path.startsWith('/api/loops') ||
      req.path.startsWith('/api/echoes') ||
      req.path.startsWith('/api/threads') ||
      req.path.startsWith('/api/context') ||
      req.path.startsWith('/api/chat');

    if (isPersonalField) {
      res.status(403).json({ error: 'Discovery credential has zero Personal Field access' });
      return;
    }

    try {
      req.body.supabaseClient = getSupabaseService();
    } catch (err: any) {
      res.status(503).json({ error: err.message });
      return;
    }

    (req as any).isDiscoverySession = true;
    (req as any).devUserId = discovery.userId;
    next();
    return;
  }

  // 2. Ephemeral Dev Session Token (dtk_...)
  if (token.startsWith('dtk_')) {
    const validated = await validateDevSessionToken(token);
    if (!validated) {
      res.status(401).json({ error: 'Invalid or expired Dev Session Token' });
      return;
    }
    try {
      req.body.supabaseClient = getSupabaseService();
    } catch (err: any) {
      res.status(503).json({ error: err.message });
      return;
    }
    (req as any).devSession = validated.session;
    (req as any).devUserId = validated.userId;
    next();
    return;
  }

  // 3. User JWT Token
  const userId = await getUserIdFromToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  req.body.supabaseClient = getSupabaseForUser(token);
  next();
};

const authenticateRestOptional = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const userId = await getUserIdFromToken(token);
      if (userId) {
        req.body.supabaseClient = getSupabaseForUser(token);
      }
    } catch {}
  }
  next();
};

app.get('/api/lunar/current', authenticateRestOptional, async (req, res) => {
  try {
    const lunar = getLunarData();
    res.json({
      phase: {
        key: lunar.phase.key,
        name: lunar.phase.name,
      },
      illumination: lunar.illumination,
      dayOfCycle: lunar.dayOfCycle,
      zodiac: {
        sign: lunar.zodiac.sign,
      },
      lunarMonth: lunar.lunarMonth,
      phaseType: lunar.phase.phaseType,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'search_luna', req.query, (req as any).devUserId);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/context', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_ai_context', {}, (req as any).devUserId);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/loops', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'list_loops', req.query, (req as any).devUserId);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/lunar-cycle/records', '/api/cycle/synthesis-context'], authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_lunar_cycle_records', req.query, (req as any).devUserId);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'create_loop', req.body);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/loops/:id', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_loop', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/loops/:id', authenticateRest, async (req, res) => {
  try {
    const args = { ...req.body, id: req.params.id };
    const result = await executeTool(req.body.supabaseClient, 'update_loop', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops/:id/close', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'close_loop', { id: req.params.id, note: req.body.note });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops/:id/reopen', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'reopen_loop', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops/:id/archive', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'archive_loop', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops/:id/restore', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'restore_loop', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loops/:id/carry-forward', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'carry_loop_forward', { id: req.params.id, new_note: req.body.new_note });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/echoes', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'search_echoes', req.query);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/echoes', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'create_echo', req.body);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/echoes/:id', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_echo', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/echoes/:id', authenticateRest, async (req, res) => {
  try {
    const args = { ...req.body, id: req.params.id };
    const result = await executeTool(req.body.supabaseClient, 'update_echo', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/echoes/:id/archive', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'archive_echo', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/echoes/:id/restore', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'restore_echo', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'search_luna', req.query);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Threads & Reflections REST API Endpoints ────────────────────────────────
app.get('/api/threads', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'list_threads', req.query);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/threads', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'create_thread', req.body);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/threads/:id', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_thread', { id: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/threads/:id', authenticateRest, async (req, res) => {
  try {
    const args = { ...req.body, id: req.params.id };
    const result = await executeTool(req.body.supabaseClient, 'update_thread', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/threads/:id/echoes/:echoId', authenticateRest, async (req, res) => {
  try {
    const args = { threadId: req.params.id, echoId: req.params.echoId, createdBy: req.body.createdBy, relationshipType: req.body.relationshipType, note: req.body.note };
    const result = await executeTool(req.body.supabaseClient, 'connect_echo_to_thread', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/threads/:id/echoes/:echoId', authenticateRest, async (req, res) => {
  try {
    const args = { threadId: req.params.id, echoId: req.params.echoId };
    const result = await executeTool(req.body.supabaseClient, 'disconnect_echo_from_thread', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/echoes/:id/reflections', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'get_echo_reflections', { echoId: req.params.id });
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/echoes/:id/reflections', authenticateRest, async (req, res) => {
  try {
    const args = { ...req.body, echoId: req.params.id };
    const result = await executeTool(req.body.supabaseClient, 'attach_reflection', args);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reflections/conversation', authenticateRest, async (req, res) => {
  try {
    const result = await executeTool(req.body.supabaseClient, 'create_conversation_reflection', req.body);
    res.json(JSON.parse(result.content[0].text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

registerChatRoutes(app, authenticateRest, authenticateRestOptional);
registerDevBridgeRoutes(app, authenticateRest);

import { LUNA_OPENAPI_SPEC, LUNA_CORE_OPENAPI_SPEC, LUNA_DEV_OPENAPI_SPEC } from './openapi.js';

app.get(['/openapi.json', '/api/openapi.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(LUNA_OPENAPI_SPEC);
});

app.get(['/openapi-core.json', '/api/openapi-core.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(LUNA_CORE_OPENAPI_SPEC);
});

app.get(['/openapi-dev.json', '/api/openapi-dev.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(LUNA_DEV_OPENAPI_SPEC);
});

app.get('/status', (req, res) => {
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  res.json({
    status: 'healthy',
    activeSessionsCount: activeSessions.size,
    privilegedDiscoveryConfigured: hasServiceRole,
    timestamp: new Date().toISOString()
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Luna Loop MCP Server running on port ${PORT}`);
  console.log(`OAuth endpoints: /oauth/authorize, /oauth/token`);
  console.log(`SSE connection endpoint: /sse`);
});
