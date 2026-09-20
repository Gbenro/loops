import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { executeTool } from './tools.js';
import { getLunarData } from './lunar.js';
import {
  listDevIssues,
  getDevIssue,
  createDevIssue,
  updateDevIssueStatus,
  listDevEvents,
  appendDevEvent,
  createDevSession,
  claimPendingDevSession,
  endDevSession,
  listPendingDevSessions,
  getDevQueueState,
  createDevAsset,
  listDevAssets,
  getDevAssetById,
  ackDevAsset,
  buildAssetPreviewUrls,
  getStorageSignedUrl,
  sanitizeSecretContent,
  sanitizeSecretMetadata,
  DevEventType,
} from './devBridge.js';

/**
 * Creative Studio Manifest — Video 1: "Creating With the Cycles V1"
 */

/**
 * Normalizes request payload across Command Center endpoints:
 * merges raw body properties and nested body.payload object, giving
 * precedence to explicit nested payload properties while stripping
 * system keys (action, payload, supabaseClient).
 */
export function extractCommandCenterPayload(body: any): Record<string, any> {
  const rawPayload = (body && body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload))
    ? body.payload
    : {};
  const flatBody = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
  const merged = { ...flatBody, ...rawPayload };
  delete (merged as any).action;
  delete (merged as any).payload;
  delete (merged as any).supabaseClient;
  return merged;
}
export const CREATIVE_VIDEO_1_MANIFEST = {
  title: 'Creating With the Cycles V1',
  version: '1.0.0',
  aspectRatio: '9:16',
  totalShots: 12,
  status: 'review',
  renderLocked: true,
  renderLockReason: 'Final video assembly strictly locked pending explicit FINAL RENDER AUTHORIZED event from Luna.',
  shots: [
    { shotId: '01', title: 'The Seed Beneath the Soil', phase: 'new_moon', duration: 4.5, assetId: 'ast_1789857778628_5s8r', status: 'review' },
    { shotId: '02', title: 'The Stirring Forest', phase: 'waxing_crescent', duration: 5.0, assetId: 'ast_1789857779442_81ht', status: 'review' },
    { shotId: '03', title: 'The Six Creative Seasons', phase: 'overview', duration: 6.0, seasons: 6, status: 'review' },
    { shotId: '04', title: 'The Moon in Rhythm', phase: 'cosmic_clock', duration: 4.5, assetId: 'ast_1789857786515_drcy', status: 'review' },
    { shotId: '05', title: 'The Monday Paradox', phase: 'linear_time', duration: 5.0, assetId: 'ast_1789857787341_4u3h', status: 'review' },
    { shotId: '06', title: 'The Ripple', phase: 'first_action', duration: 4.0, assetId: 'ast_1789857787785_rt22', status: 'review' },
    { shotId: '07', title: 'Monday Dilemma A/B', phase: 'tension', duration: 5.5, variants: ['A', 'B'], status: 'review' },
    { shotId: '08', title: 'Waxing & Waning Polarity', phase: 'dual_rhythm', duration: 5.0, variants: ['waxing', 'waning'], status: 'review' },
    { shotId: '09', title: 'Human Entry', phase: 'embodiment', duration: 4.5, assetId: 'ast_1789857789929_4zlk', status: 'review' },
    { shotId: '10', title: 'Begin & Build', phase: 'waxing_gibbous', duration: 5.0, variants: ['begin', 'build'], status: 'review' },
    { shotId: '11', title: 'Full Expression', phase: 'full_moon', duration: 6.0, assetId: 'ast_1789857790652_8kfj', status: 'review' },
    { shotId: '12', title: 'Release & Rest', phase: 'dark_moon', duration: 5.5, variants: ['release', 'rest'], status: 'review' },
  ],
};

/**
 * Luna Command Center Capabilities Registry
 */
export const COMMAND_CENTER_CAPABILITIES = {
  version: '1.0.0',
  description: 'Unified 6-operation Command Center Gateway for Luna GPT Custom Actions',
  targetGptOperationCount: 6,
  baselineMigrationCount: 29,
  hubs: {
    capabilities: {
      operationId: 'command_center_capabilities',
      method: 'GET',
      path: '/api/luna/command-center/capabilities',
      description: 'Dynamic discovery of hubs, actions, parameters, and permission scopes.',
    },
    core: {
      operationId: 'command_center_core',
      method: 'POST',
      path: '/api/luna/command-center/core',
      description: 'Sub-action routing for Loops, Echoes, Relational Memory, Threads, and Lunar Clock.',
      permission: 'user_authenticated',
      allowDiscoveryToken: false,
      subActions: [
        'lunar.get_context',
        'field.search',
        'echoes.search',
        'echoes.get',
        'echoes.create',
        'echoes.update',
        'echoes.archive',
        'echoes.restore',
        'reflections.create',
        'reflections.attach',
        'loops.list',
        'loops.get',
        'loops.create',
        'loops.update',
        'loops.close',
        'loops.reopen',
        'loops.archive',
        'loops.restore',
        'loops.carry_forward',
        'threads.list',
        'threads.get',
        'threads.create',
        'threads.update',
        'threads.connect_echo',
        'threads.disconnect_echo',
        'chat.list_sessions',
        'chat.get_session',
        'chat.search_messages',
        'chat.evaluations',
        'chat.inference_summary',
        'chat.rename_session',
        'chat.archive_session',
        'chat.preserve_to_field',
      ],
    },
    dev: {
      operationId: 'command_center_dev',
      method: 'POST',
      path: '/api/luna/command-center/dev',
      description: 'Sub-action routing for Dev Issues, Sessions, Events, and Queue Telemetry.',
      permission: 'dev_scoped',
      allowDiscoveryToken: true,
      subActions: [
        'dev.issues.list',
        'dev.issues.get',
        'dev.issues.create',
        'dev.issues.update_status',
        'dev.events.list',
        'dev.events.post',
        'dev.sessions.create',
        'dev.sessions.claim',
        'dev.sessions.end',
        'dev.sessions.pending',
        'dev.queue.get_state',
      ],
    },
    lab: {
      operationId: 'command_center_lab',
      method: 'POST',
      path: '/api/luna/command-center/lab',
      description: 'Sub-action routing for Attention Lab V1.1.0 and Model Routing Lab.',
      permission: 'lab_scoped',
      allowDiscoveryToken: true,
      subActions: [
        'lab.status',
        'lab.attention.plan',
        'lab.attention.run',
        'lab.attention.create_session',
        'lab.attention.inspect_session',
        'lab.attention.list_benchmarks',
        'lab.attention.evaluate_benchmark',
      ],
    },
    creative: {
      operationId: 'command_center_creative',
      method: 'POST',
      path: '/api/luna/command-center/creative',
      description: 'Sub-action routing for Creative Studio manifests, scene prompts, and render lock.',
      permission: 'creative_scoped',
      allowDiscoveryToken: true,
      subActions: [
        'creative.manifest.get',
        'creative.shots.list',
        'creative.shots.get',
        'creative.status',
        'creative.render_lock.status',
      ],
    },
    assets: {
      operationId: 'command_center_assets',
      method: 'POST',
      path: '/api/luna/command-center/assets',
      description: 'Sub-action routing for Asset Bridge upload, download URL generation, local ingestion ack, and review-state preview retrieval.',
      permission: 'asset_scoped',
      allowDiscoveryToken: true,
      subActions: [
        'assets.list',
        'assets.get',
        'assets.upload',
        'assets.ack',
      ],
    },
  },
};

async function resolveUser(req: Request, supabase: SupabaseClient): Promise<{ userId: string | null; isDiscovery: boolean }> {
  if ((req as any).isDiscoverySession) {
    return { userId: (req as any).devUserId || process.env.LUNA_DEV_DEFAULT_USER_ID || 'a7def673-5786-4d52-833f-2e7e2dbc7b05', isDiscovery: true };
  }
  if ((req as any).devUserId) {
    return { userId: (req as any).devUserId, isDiscovery: false };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { userId: user?.id || null, isDiscovery: false };
  } catch {
    return { userId: null, isDiscovery: false };
  }
}

/**
 * Register Command Center Gateway Routes
 */
export function registerCommandCenterRoutes(app: Express, authenticateRest: any) {
  // 1. command_center_capabilities
  app.get('/api/luna/command-center/capabilities', (req: Request, res: Response) => {
    res.json(COMMAND_CENTER_CAPABILITIES);
  });

  // 2. command_center_core
  app.post('/api/luna/command-center/core', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { userId, isDiscovery } = await resolveUser(req, supabase);

    if (isDiscovery) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DISCOVERY_FORBIDDEN',
          message: 'Discovery credentials have zero Personal Field access.',
        },
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required for Personal Field.' },
      });
    }

    const action = req.body?.action;
    const payload = extractCommandCenterPayload(req.body);
    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTION', message: 'action is required.' },
      });
    }

    try {
      let result: any = null;
      switch (action) {
        case 'lunar.get_context': {
          const lunar = getLunarData();
          result = {
            phase: { key: lunar.phase.key, name: lunar.phase.name, phaseType: lunar.phase.phaseType },
            illumination: lunar.illumination,
            dayOfCycle: lunar.dayOfCycle,
            zodiac: { sign: lunar.zodiac.sign },
            lunarMonth: lunar.lunarMonth,
          };
          break;
        }
        case 'field.search': {
          const execRes = await executeTool(supabase, 'search_luna', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.search':
        case 'echoes.list': {
          const execRes = await executeTool(supabase, 'search_echoes', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.get': {
          const execRes = await executeTool(supabase, 'get_echo', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.create': {
          const execRes = await executeTool(supabase, 'create_echo', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.update': {
          const execRes = await executeTool(supabase, 'update_echo', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.archive': {
          const execRes = await executeTool(supabase, 'archive_echo', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'echoes.restore': {
          const execRes = await executeTool(supabase, 'restore_echo', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'reflections.create': {
          const execRes = await executeTool(supabase, 'create_conversation_reflection', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'reflections.attach': {
          const execRes = await executeTool(supabase, 'attach_reflection', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.list': {
          const execRes = await executeTool(supabase, 'list_loops', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.get': {
          const execRes = await executeTool(supabase, 'get_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.create': {
          const execRes = await executeTool(supabase, 'create_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.update': {
          const execRes = await executeTool(supabase, 'update_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.close': {
          const execRes = await executeTool(supabase, 'close_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.reopen': {
          const execRes = await executeTool(supabase, 'reopen_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.archive': {
          const execRes = await executeTool(supabase, 'archive_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.restore': {
          const execRes = await executeTool(supabase, 'restore_loop', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'loops.carry_forward': {
          const execRes = await executeTool(supabase, 'carry_loop_forward', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.list': {
          const execRes = await executeTool(supabase, 'list_threads', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.get': {
          const execRes = await executeTool(supabase, 'get_thread', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.create': {
          const execRes = await executeTool(supabase, 'create_thread', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.update': {
          const execRes = await executeTool(supabase, 'update_thread', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.connect_echo': {
          const execRes = await executeTool(supabase, 'connect_echo_to_thread', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'threads.disconnect_echo': {
          const execRes = await executeTool(supabase, 'disconnect_echo_from_thread', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'chat.list_sessions': {
          const execRes = await executeTool(supabase, 'list_chat_sessions', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'chat.get_session': {
          const sessionId = payload.id || payload.sessionId;
          const { data: session, error: sError } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();
          if (sError || !session) throw new Error('Session not found');
          const { data: messages } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
          result = { session, messages: messages || [] };
          break;
        }
        case 'chat.search_messages': {
          let q = supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(payload.limit) || 50, 200));
          if (payload.sessionId) q = q.eq('session_id', payload.sessionId);
          if (payload.query) q = q.ilike('content', `%${payload.query}%`);
          const { data: messages, error } = await q;
          if (error) throw error;
          result = { messages: messages || [] };
          break;
        }
        case 'chat.evaluations': {
          const { data, error } = await supabase
            .from('chat_evaluations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(payload.limit) || 50, 200));
          if (error) throw error;
          result = { evaluations: data || [] };
          break;
        }
        case 'chat.inference_summary': {
          let query = supabase
            .from('chat_telemetry')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (payload.sessionId) query = query.eq('session_id', payload.sessionId);
          if (payload.date) query = query.gte('created_at', `${payload.date}T00:00:00.000Z`).lte('created_at', `${payload.date}T23:59:59.999Z`);
          const { data: traces, error } = await query.limit(200);
          if (error) throw error;
          const items = traces || [];
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let totalLatency = 0;
          let totalCost = 0;
          items.forEach((t: any) => {
            const usage = t.token_usage || {};
            totalInputTokens += usage.input || 0;
            totalOutputTokens += usage.output || 0;
            totalLatency += t.latency_ms || 0;
            totalCost += Number(t.inference_cost) || 0;
          });
          result = {
            totalTurns: items.length,
            totalInputTokens,
            totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            avgLatencyMs: items.length ? Math.round(totalLatency / items.length) : 0,
            estimatedTotalCostUsd: Number(totalCost.toFixed(4)),
          };
          break;
        }
        case 'chat.rename_session': {
          const execRes = await executeTool(supabase, 'rename_chat_session', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'chat.archive_session': {
          const execRes = await executeTool(supabase, 'archive_chat_session', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'chat.preserve_to_field': {
          const execRes = await executeTool(supabase, 'preserve_chat_to_field', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            error: { code: 'UNKNOWN_SUB_ACTION', message: `Unknown core sub-action: ${action}` },
          });
      }
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
      });
    }
  });

  // 3. command_center_dev
  app.post('/api/luna/command-center/dev', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { userId } = await resolveUser(req, supabase);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required for Dev Bridge.' },
      });
    }

    const action = req.body?.action;
    const payload = extractCommandCenterPayload(req.body);
    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTION', message: 'action is required.' },
      });
    }

    try {
      let result: any = null;
      switch (action) {
        case 'dev.issues.list': {
          result = await listDevIssues(supabase, userId, payload);
          break;
        }
        case 'dev.issues.get': {
          result = await getDevIssue(supabase, userId, payload.id || payload.issueId || payload.issue_id);
          break;
        }
        case 'dev.issues.create': {
          result = await createDevIssue(supabase, userId, payload as any);
          break;
        }
        case 'dev.issues.update_status': {
          result = await updateDevIssueStatus(supabase, userId, payload.id || payload.issueId || payload.issue_id, payload.status);
          break;
        }
        case 'dev.events.list': {
          result = await listDevEvents(supabase, userId, payload.issueId || payload.issue_id || payload.id, payload.sessionId || payload.session_id);
          break;
        }
        case 'dev.events.post': {
          const issueId = payload.issueId || payload.issue_id || payload.id;
          if (!issueId) {
            return res.status(400).json({
              success: false,
              error: { code: 'MISSING_ISSUE_ID', message: 'issueId is required for dev.events.post' },
            });
          }
          let sessionId = payload.sessionId || payload.session_id;
          if (!sessionId) {
            const { data: activeSession } = await supabase
              .from('dev_sessions')
              .select('id')
              .eq('issue_id', issueId)
              .eq('user_id', userId)
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeSession?.id) {
              sessionId = activeSession.id;
            } else {
              const autoSession = await createDevSession(supabase, userId, {
                issueId,
                agent: (payload.author as string) || (payload.agent as string) || 'luna',
              } as any);
              sessionId = autoSession.id;
            }
          }
          const sanitizedContent = sanitizeSecretContent(payload.content || '');
          const sanitizedMeta = sanitizeSecretMetadata(payload.metadata || {});
          result = await appendDevEvent(supabase, userId, {
            issueId,
            sessionId,
            type: (payload.type as DevEventType) || 'verification.reported',
            author: (payload.author as 'gemini' | 'luna' | 'user') || 'luna',
            content: sanitizedContent,
            metadata: sanitizedMeta,
          });
          break;
        }
        case 'dev.sessions.create': {
          result = await createDevSession(supabase, userId, {
            ...payload,
            issueId: payload.issueId || payload.issue_id,
          } as any);
          break;
        }
        case 'dev.sessions.claim': {
          result = await claimPendingDevSession(supabase, userId, payload.sessionId || payload.session_id || payload.id);
          break;
        }
        case 'dev.sessions.end': {
          result = await endDevSession(supabase, userId, payload.sessionId || payload.session_id || payload.id);
          break;
        }
        case 'dev.sessions.pending': {
          result = await listPendingDevSessions(supabase, userId, payload.since);
          break;
        }
        case 'dev.queue.get_state': {
          result = await getDevQueueState(supabase, userId);
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            error: { code: 'UNKNOWN_SUB_ACTION', message: `Unknown dev sub-action: ${action}` },
          });
      }
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
      });
    }
  });

  // 4. command_center_lab
  app.post('/api/luna/command-center/lab', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { userId } = await resolveUser(req, supabase);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required for Attention Lab.' },
      });
    }

    const action = req.body?.action;
    const payload = extractCommandCenterPayload(req.body);
    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTION', message: 'action is required.' },
      });
    }

    try {
      let result: any = null;
      switch (action) {
        case 'lab.status': {
          result = {
            labVersion: '1.1.0',
            supportedBudgets: [3000, 6000, 12000, 24000, 48000],
            conditions: ['control', 'broad', 'attention_v1'],
            status: 'operational',
          };
          break;
        }
        case 'lab.attention.plan': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_plan', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'lab.attention.run': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_run_comparison', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'lab.attention.create_session': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_create_session', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'lab.attention.inspect_session': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_inspect_session', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'lab.attention.list_benchmarks': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_list_benchmarks', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        case 'lab.attention.evaluate_benchmark': {
          const execRes = await executeTool(supabase, 'lunar_lab_attention_evaluate_benchmark', payload, userId);
          result = JSON.parse(execRes.content[0].text);
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            error: { code: 'UNKNOWN_SUB_ACTION', message: `Unknown lab sub-action: ${action}` },
          });
      }
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
      });
    }
  });

  // 5. command_center_creative
  app.post('/api/luna/command-center/creative', authenticateRest, async (req: Request, res: Response) => {
    const action = req.body?.action;
    const payload = extractCommandCenterPayload(req.body);
    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTION', message: 'action is required.' },
      });
    }

    try {
      let result: any = null;
      switch (action) {
        case 'creative.manifest.get': {
          result = CREATIVE_VIDEO_1_MANIFEST;
          break;
        }
        case 'creative.shots.list': {
          result = CREATIVE_VIDEO_1_MANIFEST.shots;
          break;
        }
        case 'creative.shots.get': {
          const shot = CREATIVE_VIDEO_1_MANIFEST.shots.find((s) => s.shotId === String(payload.shotId));
          if (!shot) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Shot ${payload.shotId} not found` } });
          }
          result = shot;
          break;
        }
        case 'creative.status': {
          result = {
            video: CREATIVE_VIDEO_1_MANIFEST.title,
            aspectRatio: CREATIVE_VIDEO_1_MANIFEST.aspectRatio,
            totalShots: CREATIVE_VIDEO_1_MANIFEST.totalShots,
            uploadedPreviews: 21,
            status: CREATIVE_VIDEO_1_MANIFEST.status,
            renderLocked: CREATIVE_VIDEO_1_MANIFEST.renderLocked,
          };
          break;
        }
        case 'creative.render_lock.status': {
          result = {
            renderLocked: true,
            authorizationRequired: 'FINAL RENDER AUTHORIZED',
            message: 'Final video render is strictly locked. Assembly remains halted until Luna issues an explicit FINAL RENDER AUTHORIZED event.',
          };
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            error: { code: 'UNKNOWN_SUB_ACTION', message: `Unknown creative sub-action: ${action}` },
          });
      }
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
      });
    }
  });

  // 6. command_center_assets
  app.post('/api/luna/command-center/assets', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { userId } = await resolveUser(req, supabase);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required for Creative Asset Bridge.' },
      });
    }

    const action = req.body?.action;
    const payload = extractCommandCenterPayload(req.body);
    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTION', message: 'action is required.' },
      });
    }

    try {
      let result: any = null;
      switch (action) {
        case 'assets.list': {
          const filterObj: any = {};
          if (payload.status) filterObj.status = payload.status;
          if (payload.projectId) filterObj.projectId = payload.projectId;
          if (payload.shotId) filterObj.shotId = payload.shotId;
          if (payload.batch) filterObj.batch = Number(payload.batch);
          const assets = await listDevAssets(supabase, userId, filterObj);
          result = await Promise.all(assets.map(async (a) => {
            const storageUrl = await getStorageSignedUrl(supabase, a);
            const { downloadUrl, previewUrl, pathUrl, queryPreviewUrl } = buildAssetPreviewUrls(req, a.id, a.filename);
            const effectiveUrl = storageUrl || pathUrl;
            return {
              id: a.id,
              filename: a.filename,
              mimeType: a.mimeType,
              status: a.status,
              downloadUrl: storageUrl || downloadUrl,
              previewUrl: effectiveUrl,
              pathUrl,
              queryPreviewUrl,
              directStorageUrl: storageUrl || null,
              railwayUrl: pathUrl,
              imageUrl: effectiveUrl,
              image_url: effectiveUrl,
              displayMarkdown: `![${a.filename || 'Visual Asset'}](${effectiveUrl})`,
              checksum: a.checksum,
              projectId: a.projectId,
              shotId: a.shotId,
              role: a.role,
              kind: a.kind,
              createdAt: a.createdAt,
              prompt: a.prompt,
              motionIntent: a.motionIntent,
              metadata: (a as any).metadata || {},
            };
          }));
          break;
        }
        case 'assets.get': {
          const assetId = payload.id || payload.assetId || payload.asset_id;
          if (!assetId) {
            return res.status(400).json({ success: false, error: { code: 'MISSING_ASSET_ID', message: 'Asset id is required.' } });
          }
          const asset = await getDevAssetById(supabase, userId, assetId);
          if (!asset) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found.' } });
          }
          const storageUrl = await getStorageSignedUrl(supabase, asset);
          const { downloadUrl, previewUrl, pathUrl, queryPreviewUrl } = buildAssetPreviewUrls(req, asset.id, asset.filename);
          const effectiveUrl = storageUrl || pathUrl;
          result = {
            id: asset.id,
            filename: asset.filename,
            mimeType: asset.mimeType,
            status: asset.status,
            downloadUrl: storageUrl || downloadUrl,
            previewUrl: effectiveUrl,
            pathUrl,
            queryPreviewUrl,
            directStorageUrl: storageUrl || null,
            railwayUrl: pathUrl,
            imageUrl: effectiveUrl,
            image_url: effectiveUrl,
            displayMarkdown: `![${asset.filename || 'Visual Asset'}](${effectiveUrl})`,
            noteForAssistant: `To visually inspect or display this image in chat, render: ![${asset.filename || 'Visual Asset'}](${effectiveUrl})`,
            checksum: asset.checksum,
            projectId: asset.projectId,
            shotId: asset.shotId,
            role: asset.role,
            kind: asset.kind,
            createdAt: asset.createdAt,
            prompt: asset.prompt,
            motionIntent: asset.motionIntent,
            metadata: (asset as any).metadata || {},
            dataBase64: payload.includeBase64 ? asset.dataBase64 : undefined,
          };
          break;
        }
        case 'assets.upload': {
          const created = await createDevAsset(supabase, userId, payload as any);
          const { downloadUrl, previewUrl } = buildAssetPreviewUrls(req, created.id);
          result = {
            id: created.id,
            filename: created.filename,
            mimeType: created.mimeType,
            status: created.status,
            downloadUrl,
            previewUrl,
            checksum: created.checksum,
            projectId: created.projectId,
            shotId: created.shotId,
            role: created.role,
            kind: created.kind,
            createdAt: created.createdAt,
            prompt: created.prompt,
            motionIntent: created.motionIntent,
            metadata: (created as any).metadata || {},
          };
          break;
        }
        case 'assets.ack': {
          const assetId = payload.id || payload.assetId || payload.asset_id;
          if (!assetId) {
            return res.status(400).json({ success: false, error: { code: 'MISSING_ASSET_ID', message: 'Asset id is required.' } });
          }
          const asset = await ackDevAsset(supabase, userId, assetId);
          result = {
            id: asset.id,
            ingestedLocally: asset.ingestedLocally,
            status: asset.status,
            updatedAt: asset.updatedAt,
          };
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            error: { code: 'UNKNOWN_SUB_ACTION', message: `Unknown asset sub-action: ${action}` },
          });
      }
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
      });
    }
  });
}
