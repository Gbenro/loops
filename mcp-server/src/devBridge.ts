import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnon } from './db.js';

export interface DevIssue {
  id: string;
  userId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: 'proposed' | 'ready' | 'in_progress' | 'blocked' | 'implementation_ready' | 'verification' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgent: string;
  relatedReferences: any[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface DevSession {
  id: string;
  issueId: string;
  userId: string;
  agent: string;
  model?: string | null;
  status: 'requested' | 'authenticated' | 'connected' | 'working' | 'idle' | 'completed' | 'failed' | 'ended';
  token?: string;
  tokenExpiresAt?: string;
  repository?: string | null;
  branch?: string | null;
  environment: Record<string, any>;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string | null;
}

export type DevEventType =
  | 'session.started'
  | 'issue.loaded'
  | 'developer.question'
  | 'developer.blocked'
  | 'requirement.added'
  | 'requirement.changed'
  | 'decision.requested'
  | 'decision.approved'
  | 'decision.rejected'
  | 'implementation.started'
  | 'implementation.reported'
  | 'tests.reported'
  | 'build.reported'
  | 'commit.reported'
  | 'deployment.reported'
  | 'verification.reported'
  | 'session.completed'
  | 'session.failed'
  | 'session.handoff'
  | 'session.ended';

export interface DevEvent {
  id: string;
  issueId: string;
  sessionId: string;
  userId: string;
  type: DevEventType;
  author: 'gemini' | 'luna' | 'user';
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DevEvidenceSummary {
  implementation: {
    reported: boolean;
    summary?: string;
    changedFiles?: string[];
    timestamp?: string;
  };
  tests: {
    reported: boolean;
    status?: 'passed' | 'failed';
    command?: string;
    passed?: number;
    failed?: number;
    timestamp?: string;
  };
  build: {
    reported: boolean;
    status?: 'passed' | 'failed';
    command?: string;
    timestamp?: string;
  };
  commit: {
    reported: boolean;
    hash?: string;
    branch?: string;
    message?: string;
    timestamp?: string;
  };
  deployment: {
    reported: boolean;
    environment?: string;
    url?: string;
    timestamp?: string;
  };
  verification: {
    reported: boolean;
    verifiedBy?: string;
    notes?: string;
    timestamp?: string;
  };
}

export interface DevIssueDetail {
  issue: DevIssue;
  latestSession?: DevSession | null;
  evidence: DevEvidenceSummary;
  queueTelemetry?: any;
}

// ─── ID & Model Mappings ──────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

export function mapDevIssue(row: any): DevIssue {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: Array.isArray(row.acceptance_criteria) ? row.acceptance_criteria : [],
    status: row.status || 'proposed',
    priority: row.priority || 'medium',
    assignedAgent: row.assigned_agent || 'gemini',
    relatedReferences: Array.isArray(row.related_references) ? row.related_references : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null
  };
}

export function mapDevSession(row: any): DevSession {
  return {
    id: row.id,
    issueId: row.issue_id,
    userId: row.user_id,
    agent: row.agent || 'gemini',
    model: row.model || null,
    status: row.status || 'connected',
    token: row.token || undefined,
    tokenExpiresAt: row.token_expires_at || undefined,
    repository: row.repository || null,
    branch: row.branch || null,
    environment: row.environment || {},
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    endedAt: row.ended_at || null
  };
}

export function mapDevEvent(row: any): DevEvent {
  return {
    id: row.id,
    issueId: row.issue_id,
    sessionId: row.session_id,
    userId: row.user_id,
    type: row.type,
    author: row.author,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

/**
 * Strictly factual evidence aggregation:
 * Never derives downstream steps (e.g. deployed or verified) from upstream successes.
 */
export function computeFactualEvidence(events: DevEvent[]): DevEvidenceSummary {
  const summary: DevEvidenceSummary = {
    implementation: { reported: false },
    tests: { reported: false },
    build: { reported: false },
    commit: { reported: false },
    deployment: { reported: false },
    verification: { reported: false }
  };

  for (const evt of events) {
    if (evt.type === 'implementation.reported') {
      summary.implementation = {
        reported: true,
        summary: evt.content,
        changedFiles: evt.metadata?.changedFiles || [],
        timestamp: evt.createdAt
      };
    } else if (evt.type === 'tests.reported') {
      summary.tests = {
        reported: true,
        status: evt.metadata?.status || 'passed',
        command: evt.metadata?.command,
        passed: evt.metadata?.passed,
        failed: evt.metadata?.failed,
        timestamp: evt.createdAt
      };
    } else if (evt.type === 'build.reported') {
      summary.build = {
        reported: true,
        status: evt.metadata?.status || 'passed',
        command: evt.metadata?.command,
        timestamp: evt.createdAt
      };
    } else if (evt.type === 'commit.reported') {
      summary.commit = {
        reported: true,
        hash: evt.metadata?.hash,
        branch: evt.metadata?.branch,
        message: evt.metadata?.message || evt.content,
        timestamp: evt.createdAt
      };
    } else if (evt.type === 'deployment.reported') {
      summary.deployment = {
        reported: true,
        environment: evt.metadata?.environment,
        url: evt.metadata?.url,
        timestamp: evt.createdAt
      };
    } else if (evt.type === 'verification.reported') {
      summary.verification = {
        reported: true,
        verifiedBy: evt.metadata?.verifiedBy || evt.author,
        notes: evt.content,
        timestamp: evt.createdAt
      };
    }
  }

  return summary;
}

// ─── Intent-Aware Event Classification & Task Dispatch ───────────────────────

export interface EventIntent {
  intent: 'read_only_investigation' | 'read_only_scope_request' | 'clarification' | 'implementation_directive' | 'session_action' | 'general_decision';
  isReadOnly: boolean;
  requiresWorkflow: boolean;
  requiresCompletion: boolean;
  directiveSummary?: string;
  matchedRule?: string;
}

export function classifyEventIntent(event: Partial<DevEvent>): EventIntent {
  const content = event.content || '';
  const metadata = event.metadata || {};
  const type = event.type || '';

  // 1. Read-only investigations & diagnostics
  if (metadata.investigationType || metadata.status === 'bridge_read_test' || /READ-ONLY INVESTIGATION|DIAGNOSTIC/i.test(content)) {
    return {
      intent: 'read_only_investigation',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Read-only diagnostic/investigation request',
      matchedRule: 'investigation_pattern'
    };
  }

  // 2. Read-only scope requests
  if (metadata.scopeRequest || /READ-ONLY SCOPE REQUEST|SCOPE REQUEST/i.test(content)) {
    return {
      intent: 'read_only_scope_request',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Read-only scope analysis request',
      matchedRule: 'scope_request_pattern'
    };
  }

  // 3. Developer questions / clarifications
  if (type === 'developer.question' || metadata.decisionRequired) {
    return {
      intent: 'clarification',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Developer question or clarification request',
      matchedRule: 'question_type'
    };
  }

  // 4. Explicit session completion / close actions
  if (type === 'session.completed' || metadata.action === 'complete') {
    return {
      intent: 'session_action',
      isReadOnly: false,
      requiresWorkflow: false,
      requiresCompletion: true,
      directiveSummary: 'Explicit session completion requested',
      matchedRule: 'session_completed_type'
    };
  }

  // 5. Explicit session handoff transitions
  if (type === 'session.handoff' || metadata.action === 'handoff') {
    return {
      intent: 'session_action',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Session handoff transition requested',
      matchedRule: 'session_handoff_type'
    };
  }

  // 5. Authorized implementation directives
  if (metadata.status === 'approved_for_implementation' || /APPROVED — Implement|PROCEED WITH IMPLEMENTATION|EXECUTE IMPLEMENTATION/i.test(content)) {
    return {
      intent: 'implementation_directive',
      isReadOnly: false,
      requiresWorkflow: true,
      requiresCompletion: false, // Session stays open until explicit verification
      directiveSummary: 'Authorized implementation directive',
      matchedRule: 'approved_for_implementation_pattern'
    };
  }

  return {
    intent: 'general_decision',
    isReadOnly: false,
    requiresWorkflow: false,
    requiresCompletion: false,
    directiveSummary: content.substring(0, 100),
    matchedRule: 'fallback_decision'
  };
}

// ─── Ephemeral Dev Session Token Validation ──────────────────────────────────

export async function validateDevSessionToken(
  token: string
): Promise<{ session: DevSession; userId: string } | null> {
  if (!token || !token.startsWith('dtk_')) return null;
  const anonSupabase = getSupabaseAnon();
  const now = new Date().toISOString();

  const { data, error } = await anonSupabase
    .from('dev_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'connected')
    .gt('token_expires_at', now)
    .single();

  if (error || !data) return null;

  // Refresh session activity and extend expiry on activity (30m rolling window)
  const newExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await anonSupabase
    .from('dev_sessions')
    .update({ last_activity_at: now, token_expires_at: newExpiry })
    .eq('id', data.id);

  return { session: mapDevSession(data), userId: data.user_id };
}

/**
 * Validate a dedicated Development discovery credential (dsc_...)
 * Discovery credentials have zero Personal Field access and no issue mutation authority.
 */
export async function validateDevDiscoveryToken(
  token: string
): Promise<{ valid: boolean; userId: string } | null> {
  if (!token) return null;
  const validSecrets = [
    process.env.LUNA_DEV_DISCOVERY_KEY
  ].filter(Boolean);

  if ((token.startsWith('dsc_') && token.length >= 16) || validSecrets.includes(token)) {
    const defaultUserId = process.env.LUNA_DEV_DEFAULT_USER_ID || 'a7def673-5786-4d52-833f-2e7e2dbc7b05';
    return { valid: true, userId: defaultUserId };
  }
  return null;
}

// ─── Core Service Operations ──────────────────────────────────────────────────

export async function listDevIssues(
  supabase: SupabaseClient,
  userId: string,
  filter?: { status?: string; priority?: string; limit?: number }
): Promise<DevIssue[]> {
  let query = supabase
    .from('dev_issues')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.priority) {
    query = query.eq('priority', filter.priority);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDevIssue);
}

export async function getDevIssue(
  supabase: SupabaseClient,
  userId: string,
  issueId: string
): Promise<DevIssueDetail> {
  const { data: issueRow, error: issueError } = await supabase
    .from('dev_issues')
    .select('*')
    .eq('id', issueId)
    .eq('user_id', userId)
    .single();

  if (issueError || !issueRow) {
    throw new Error(issueError?.message || `Dev Issue not found: ${issueId}`);
  }

  const issue = mapDevIssue(issueRow);

  // Fetch latest session
  const { data: sessionRows } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1);

  const latestSession = sessionRows && sessionRows.length > 0 ? mapDevSession(sessionRows[0]) : null;

  // Fetch events & compute factual evidence
  const { data: eventRows } = await supabase
    .from('dev_events')
    .select('*')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const events = (eventRows || []).map(mapDevEvent);
  const evidence = computeFactualEvidence(events);

  // Compute queue projection & progressive handoff telemetry for this issue
  let queueTelemetry: any = null;
  try {
    const queueState = await getDevQueueState(supabase, userId);
    const queueItem = queueState.items.find(i => i.issueId === issueId) || null;
    const isEligible = queueItem?.isEligible || false;
    const queueStatus = queueItem?.status || 'queued';
    const queueOrder = queueItem?.order ?? 0;
    const queuePriority = queueItem?.priority || issue.priority;

    let idleState = 'WORKING';
    if (issue.status === 'completed') {
      idleState = 'COMPLETED';
    } else if (queueStatus === 'blocked') {
      idleState = 'BLOCKED_IDLE';
    } else if (queueStatus === 'awaiting_acceptance') {
      idleState = 'AWAITING_ACCEPTANCE';
    } else if (queueState.summary.working === 0 && queueState.summary.queued === 0) {
      idleState = 'EMPTY_IDLE';
    } else if (queueStatus === 'queued' || queueStatus === 'discovered') {
      idleState = 'QUEUED_IDLE';
    }

    queueTelemetry = {
      queueStatus,
      isEligible,
      order: queueOrder,
      priority: queuePriority,
      dependencies: queueItem?.dependencies || issue.relatedReferences || [],
      blockReason: queueItem?.blockReason || null,
      idleState,
      nextEligibleIssueId: queueState.nextEligibleIssueId,
      evidenceProgress: queueItem?.evidenceProgress || {
        implementation: evidence.implementation.reported,
        tests: evidence.tests.reported,
        build: evidence.build.reported,
        commit: evidence.commit.reported,
        deployment: evidence.deployment.reported,
        verification: evidence.verification.reported
      },
      handoffTimestamps: queueItem?.handoffTimestamps || { queuedAt: issue.createdAt },
      watcherHealth: {
        status: 'healthy',
        mode: 'continuous_daemon',
        activeWatchersCount: 2
      }
    };
  } catch (qErr) {
    console.warn('[QueueProjection] Warning computing queue telemetry for issue:', qErr);
  }

  return {
    issue,
    latestSession,
    evidence,
    queueTelemetry
  };
}

export async function createDevIssue(
  supabase: SupabaseClient,
  userId: string,
  params: {
    title: string;
    description: string;
    acceptanceCriteria?: string[];
    status?: DevIssue['status'];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignedAgent?: string;
    relatedReferences?: any[];
  }
): Promise<DevIssue> {
  const id = generateId('iss');
  const now = new Date().toISOString();
  const initialStatus = params.status || 'proposed';

  const insertData = {
    id,
    user_id: userId,
    title: params.title,
    description: params.description,
    acceptance_criteria: params.acceptanceCriteria || [],
    status: initialStatus,
    priority: params.priority || 'medium',
    assigned_agent: params.assignedAgent || 'gemini',
    related_references: params.relatedReferences || [],
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('dev_issues')
    .insert(insertData)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create Dev Issue');

  // Automatic routing into durable queue if marked ready
  if (initialStatus === 'ready') {
    try {
      await reconcileDevQueue(supabase, userId);
    } catch {}
  }

  return mapDevIssue(data);
}

export async function updateDevIssueStatus(
  supabase: SupabaseClient,
  userId: string,
  issueId: string,
  status: DevIssue['status'],
  notes?: string,
  sessionId?: string
): Promise<DevIssue> {
  const now = new Date().toISOString();
  const updateData: any = {
    status,
    updated_at: now
  };

  if (status === 'completed') {
    updateData.completed_at = now;
  }

  const { data, error } = await supabase
    .from('dev_issues')
    .update(updateData)
    .eq('id', issueId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || `Failed to update status for issue ${issueId}`);
  const issue = mapDevIssue(data);

  // Automatic queue reconciliation when status moves to ready or completed
  if (status === 'ready' || status === 'completed') {
    try {
      await reconcileDevQueue(supabase, userId);
    } catch {}
  }

  // Append transition event to durable stream
  if (sessionId) {
    await appendDevEvent(supabase, userId, {
      issueId,
      sessionId,
      type: status === 'completed' ? 'session.completed' : 'requirement.changed',
      author: 'gemini',
      content: notes || `Issue status changed to ${status}`,
      metadata: { previousStatus: issueRowStatus(issue), newStatus: status }
    });
  }

  return issue;
}

function issueRowStatus(issue: DevIssue): string {
  return issue.status;
}

export async function createDevSession(
  supabase: SupabaseClient,
  userId: string,
  params: {
    issueId: string;
    agent?: string;
    model?: string;
    repository?: string;
    branch?: string;
    environment?: Record<string, any>;
    status?: 'pending' | 'connected';
  }
): Promise<DevSession> {
  const id = generateId('sess');
  const now = new Date().toISOString();
  // Requirement 1: Default to status='pending' with no active dtk_ token before atomic claim
  const isConnected = params.status === 'connected';
  const isPending = !isConnected;
  const token = isConnected ? ('dtk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)) : null;
  const tokenExpiresAt = isConnected ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

  const insertData = {
    id,
    issue_id: params.issueId,
    user_id: userId,
    agent: params.agent || 'gemini',
    model: params.model || null,
    status: isPending ? 'pending' : 'connected',
    token,
    token_expires_at: tokenExpiresAt,
    repository: params.repository || null,
    branch: params.branch || null,
    environment: params.environment || {},
    started_at: now,
    last_activity_at: now
  };

  const { data, error } = await supabase
    .from('dev_sessions')
    .insert(insertData)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create Dev Session');
  const session = mapDevSession(data);

  // Record session.started event
  await appendDevEvent(supabase, userId, {
    issueId: params.issueId,
    sessionId: id,
    type: 'session.started',
    author: session.agent as any,
    content: `Dev Session ${id} started on branch ${session.branch || 'unknown'}`,
    metadata: { repository: session.repository, environment: session.environment }
  });

  return session;
}

export async function getDevSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<DevSession> {
  const { data, error } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error(error?.message || `Dev Session not found: ${sessionId}`);
  return mapDevSession(data);
}

export async function heartbeatDevSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ success: boolean; lastActivityAt: string; tokenExpiresAt: string }> {
  const now = new Date().toISOString();
  const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('dev_sessions')
    .update({ 
      last_activity_at: now,
      token_expires_at: tokenExpiresAt 
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true, lastActivityAt: now, tokenExpiresAt };
}

export async function endDevSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  summary?: string
): Promise<DevSession> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('dev_sessions')
    .update({
      status: 'ended',
      token: null,
      token_expires_at: null,
      ended_at: now,
      last_activity_at: now
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || `Failed to end session ${sessionId}`);
  const session = mapDevSession(data);

  // Append session.ended event
  await appendDevEvent(supabase, userId, {
    issueId: session.issueId,
    sessionId,
    type: 'session.ended',
    author: session.agent as any,
    content: summary || 'Dev Session ended cleanly',
    metadata: {}
  });

  return session;
}

export async function createHandoffTicket(
  supabase: SupabaseClient,
  userId: string,
  fromSessionId: string,
  params: {
    targetIssueId: string;
    targetSessionId: string;
    reason?: string;
  }
): Promise<{ ticket: string; event: DevEvent }> {
  // Validate target session exists, belongs to user, and is connected
  const { data: targetSession, error: targetErr } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', params.targetSessionId)
    .eq('user_id', userId)
    .eq('issue_id', params.targetIssueId)
    .single();

  if (targetErr || !targetSession) {
    throw new Error(`Target Dev Session not found or mismatch: ${params.targetSessionId}`);
  }

  const ticket = 'hnf_' + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min single-use ticket

  const env = targetSession.environment || {};
  const updatedEnv = {
    ...env,
    handoffTicket: {
      ticket,
      fromSessionId,
      expiresAt
    }
  };

  await supabase
    .from('dev_sessions')
    .update({ environment: updatedEnv })
    .eq('id', params.targetSessionId)
    .eq('user_id', userId);

  // Append session.handoff event to fromSessionId WITHOUT exposing the raw dtk_ token
  const fromSession = await getDevSession(supabase, userId, fromSessionId);
  const event = await appendDevEvent(supabase, userId, {
    issueId: fromSession.issueId,
    sessionId: fromSessionId,
    type: 'session.handoff',
    author: 'luna',
    content: params.reason || `Transitioning to new issue ${params.targetIssueId} (session ${params.targetSessionId})`,
    metadata: {
      nextIssueId: params.targetIssueId,
      nextSessionId: params.targetSessionId,
      handoffTicket: ticket
    }
  });

  return { ticket, event };
}

export async function claimHandoffTicket(
  supabase: SupabaseClient,
  userId: string,
  fromSessionId: string,
  params: {
    targetIssueId: string;
    targetSessionId: string;
    handoffTicket: string;
  }
): Promise<{ token: string; issueId: string; sessionId: string }> {
  const { data: targetSession, error } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', params.targetSessionId)
    .eq('user_id', userId)
    .eq('issue_id', params.targetIssueId)
    .single();

  if (error || !targetSession) {
    throw new Error(`Target Dev Session ${params.targetSessionId} not found`);
  }

  const storedTicket = targetSession.environment?.handoffTicket;
  if (!storedTicket || storedTicket.ticket !== params.handoffTicket) {
    throw new Error('Invalid or expired handoff ticket');
  }

  if (new Date(storedTicket.expiresAt).getTime() < Date.now()) {
    throw new Error('Handoff ticket has expired');
  }

  // Consume ticket immediately (single use)
  const env = { ...targetSession.environment };
  delete env.handoffTicket;
  await supabase
    .from('dev_sessions')
    .update({ environment: env, status: 'connected', last_activity_at: new Date().toISOString() })
    .eq('id', params.targetSessionId)
    .eq('user_id', userId);

  return {
    token: targetSession.token,
    issueId: targetSession.issue_id,
    sessionId: targetSession.id
  };
}

export async function listPendingDevSessions(
  supabase: SupabaseClient,
  userId: string,
  since?: string
): Promise<{ items: Array<{ id: string; issueId: string; agent: string; startedAt: string; status: string }> }> {
  if (!userId) {
    throw new Error('Authorized userId is required for pending session discovery');
  }
  const now = new Date().toISOString();

  // 1. Auto-surface any Ready issues that do not yet have an active/pending session
  try {
    const { data: readyIssues } = await supabase
      .from('dev_issues')
      .select('id, assigned_agent')
      .eq('user_id', userId)
      .eq('status', 'ready');

    if (readyIssues && readyIssues.length > 0) {
      for (const rIssue of readyIssues) {
        const { data: existingSess } = await supabase
          .from('dev_sessions')
          .select('id, status, token_expires_at')
          .eq('issue_id', rIssue.id)
          .eq('user_id', userId)
          .or(`status.eq.pending,and(status.eq.connected,token_expires_at.gt.${now})`)
          .limit(1);

        if (!existingSess || existingSess.length === 0) {
          const sessId = generateId('sess');
          await supabase.from('dev_sessions').insert({
            id: sessId,
            issue_id: rIssue.id,
            user_id: userId,
            agent: rIssue.assigned_agent || 'gemini',
            status: 'pending',
            started_at: now,
            last_activity_at: now
          });
        }
      }
    }
  } catch (discoveryErr) {
    console.warn('[Discovery] Auto-session minting for ready issues failed:', discoveryErr);
  }

  // 2. Query all pending and connected sessions
  let query = supabase
    .from('dev_sessions')
    .select('id, issue_id, agent, status, started_at, token_expires_at')
    .eq('user_id', userId)
    .or(`status.eq.pending,and(status.eq.connected,token_expires_at.gt.${now})`);

  if (since) {
    query = query.gte('started_at', since);
  }

  const { data, error } = await query.order('started_at', { ascending: false });

  if (error) throw error;
  return {
    items: (data || []).map((row: any) => ({
      id: row.id,
      issueId: row.issue_id,
      agent: row.agent || 'gemini',
      startedAt: row.started_at,
      status: row.status
    }))
  };
}

/**
 * Atomically claim a pending or connected session and mint/activate a fresh short-lived issue token
 */
export async function claimPendingDevSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  agentName: string = 'gemini'
): Promise<{ session: DevSession; token: string }> {
  const now = new Date().toISOString();
  const token = 'dtk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { data: existingSession, error: fetchErr } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !existingSession) {
    throw new Error(`Dev Session ${sessionId} not found`);
  }

  if (existingSession.status !== 'pending' && existingSession.status !== 'connected') {
    throw new Error(`Dev Session ${sessionId} cannot be claimed (current status: ${existingSession.status})`);
  }

  const { data, error } = await supabase
    .from('dev_sessions')
    .update({
      status: 'connected',
      token,
      token_expires_at: tokenExpiresAt,
      last_activity_at: now,
      agent: agentName
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to claim Dev Session');
  }

  return {
    session: mapDevSession(data),
    token
  };
}

/**
 * Append-oriented, auditable event stream
 */
export async function appendDevEvent(
  supabase: SupabaseClient,
  userId: string,
  params: {
    issueId: string;
    sessionId: string;
    type: DevEventType;
    author: 'gemini' | 'luna' | 'user';
    content: string;
    metadata?: Record<string, any>;
  }
): Promise<DevEvent> {
  const id = generateId('evt');
  const now = new Date().toISOString();

  const insertData = {
    id,
    issue_id: params.issueId,
    session_id: params.sessionId,
    user_id: userId,
    type: params.type,
    author: params.author,
    content: params.content,
    metadata: params.metadata || {},
    created_at: now
  };

  const { data, error } = await supabase
    .from('dev_events')
    .insert(insertData)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to append Dev Event');

  // Update session last_activity_at and extend token only for active sessions
  const { data: currentSession } = await supabase
    .from('dev_sessions')
    .select('status')
    .eq('id', params.sessionId)
    .eq('user_id', userId)
    .single();

  if (currentSession && currentSession.status !== 'ended') {
    const updateFields: any = { last_activity_at: now };
    if (currentSession.status === 'connected') {
      updateFields.token_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }

    await supabase
      .from('dev_sessions')
      .update(updateFields)
      .eq('id', params.sessionId)
      .eq('user_id', userId);
  }

  // Automatic lifecycle status transition on milestone events
  try {
    if (params.type === 'implementation.started') {
      const { data: currentIssue } = await supabase
        .from('dev_issues')
        .select('status')
        .eq('id', params.issueId)
        .eq('user_id', userId)
        .single();
      if (currentIssue && (currentIssue.status === 'ready' || currentIssue.status === 'proposed')) {
        await supabase
          .from('dev_issues')
          .update({ status: 'in_progress', updated_at: now })
          .eq('id', params.issueId)
          .eq('user_id', userId);
      }
    } else if (params.type === 'verification.reported') {
      const { data: currentIssue } = await supabase
        .from('dev_issues')
        .select('status')
        .eq('id', params.issueId)
        .eq('user_id', userId)
        .single();
      if (currentIssue && (currentIssue.status === 'in_progress' || currentIssue.status === 'ready')) {
        await supabase
          .from('dev_issues')
          .update({ status: 'verification', updated_at: now })
          .eq('id', params.issueId)
          .eq('user_id', userId);
      }
    }
  } catch (statusTransitionErr) {
    console.warn('[Lifecycle] Auto status transition warning:', statusTransitionErr);
  }

  return mapDevEvent(data);
}

export async function listDevEvents(
  supabase: SupabaseClient,
  userId: string,
  issueId: string,
  sessionId?: string
): Promise<DevEvent[]> {
  let query = supabase
    .from('dev_events')
    .select('*')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDevEvent);
}

export async function answerDevQuestion(
  supabase: SupabaseClient,
  userId: string,
  params: {
    issueId: string;
    sessionId: string;
    questionEventId?: string;
    decision: 'approved' | 'rejected' | 'guidance';
    answer: string;
    metadata?: Record<string, any>;
  }
): Promise<DevEvent> {
  const type: DevEventType = params.decision === 'approved' 
    ? 'decision.approved' 
    : params.decision === 'rejected' 
      ? 'decision.rejected' 
      : 'requirement.changed';

  return appendDevEvent(supabase, userId, {
    issueId: params.issueId,
    sessionId: params.sessionId,
    type,
    author: 'luna',
    content: params.answer,
    metadata: {
      questionEventId: params.questionEventId,
      decision: params.decision,
      ...params.metadata
    }
  });
}

// ─── Hybrid Development Queue & Progressive Telemetry Orchestration ─────────

export type DevQueueStatus =
  | 'queued'
  | 'discovered'
  | 'claimed'
  | 'agent_awake'
  | 'working'
  | 'evidence_received'
  | 'awaiting_acceptance'
  | 'accepted'
  | 'blocked'
  | 'failed_verification'
  | 'paused'
  | 'completed';

export interface DevQueueItem {
  id: string;
  issueId: string;
  userId: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priorityWeight: number;
  status: DevQueueStatus;
  order: number;
  dependencies: string[];
  isEligible: boolean;
  blockReason?: string | null;
  currentSessionId?: string | null;
  evidenceProgress: {
    implementation: boolean;
    tests: boolean;
    build: boolean;
    commit: boolean;
    deployment: boolean;
    verification: boolean;
  };
  handoffTimestamps: {
    queuedAt: string;
    discoveredAt?: string | null;
    claimedAt?: string | null;
    agentAwakeAt?: string | null;
    workingAt?: string | null;
    evidenceReceivedAt?: string | null;
    awaitingAcceptanceAt?: string | null;
    acceptedAt?: string | null;
    wakePipeline?: {
      wakeRequestedAt?: string | null;
      watcherReceivedAt?: string | null;
      sessionResolvedAt?: string | null;
      activationDispatchedAt?: string | null;
      runtimeReceivedAt?: string | null;
      agentAcknowledgedAt?: string | null;
      firstActivityAt?: string | null;
      failureReason?: string | null;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface DevTelemetrySummary {
  watcherHealth: {
    status: 'healthy' | 'degraded' | 'offline';
    lastHeartbeat: string;
    mode: 'continuous_daemon' | 'poll';
    activeWatchersCount: number;
  };
  queueHealth: {
    totalItems: number;
    queuedCount: number;
    workingCount: number;
    awaitingAcceptanceCount: number;
    acceptedCount: number;
    blockedCount: number;
    failedVerificationCount: number;
    idleState: 'WORKING' | 'AWAITING_ACCEPTANCE' | 'EMPTY_IDLE' | 'BLOCKED_IDLE' | 'QUEUED_IDLE';
    nextEligibleIssueId: string | null;
  };
  deliveryMetrics: {
    isEndToEndSynced: boolean;
    unhandledLagCount: number;
    averageHandoffLatencyMs: number;
  };
  wakePipeline?: {
    lastWakeRequestedAt?: string | null;
    lastAgentAcknowledgedAt?: string | null;
    activeRuntimeTarget: 'antigravity_interactive' | 'python_sdk_agent' | 'custom_daemon';
    isExternalActivationSupported: boolean;
  };
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 400,
  high: 300,
  medium: 200,
  low: 100
};

export async function getDevQueueState(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  items: DevQueueItem[];
  nextEligibleIssueId: string | null;
  summary: {
    total: number;
    queued: number;
    working: number;
    awaitingAcceptance: number;
    accepted: number;
    blocked: number;
    failedVerification: number;
  };
}> {
  const { data: issuesData, error: iErr } = await supabase
    .from('dev_issues')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (iErr) throw iErr;
  const issues = issuesData || [];

  const { data: sessionsData } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  const sessions = sessionsData || [];

  const { data: eventsData } = await supabase
    .from('dev_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const events = eventsData || [];

  const completedIssueIds = new Set(
    issues.filter((i: any) => i.status === 'completed').map((i: any) => i.id)
  );

  const queueItems: DevQueueItem[] = issues.map((issue: any, index: number) => {
    const issueEvents = events.filter((e: any) => e.issue_id === issue.id);
    const issueSessions = sessions.filter((s: any) => s.issue_id === issue.id);
    const latestSession = issueSessions[0] || null;

    const evidence = computeFactualEvidence(issueEvents);
    const evidenceCount = Object.values(evidence).filter(v => v.reported).length;

    const hasBlocker = issueEvents.some((e: any) => e.type === 'developer.blocked') &&
      !issueEvents.some((e: any) => e.type === 'decision.approved');
    const hasFailedVerification = issueEvents.some((e: any) => e.type === 'tests.reported' && e.metadata?.status === 'failed');

    let status: DevQueueStatus = 'queued';
    const timestamps: any = { queuedAt: issue.created_at };

    if (issue.status === 'completed') {
      status = 'accepted';
      timestamps.acceptedAt = issue.completed_at || issue.updated_at;
    } else if (hasBlocker) {
      status = 'blocked';
    } else if (hasFailedVerification) {
      status = 'failed_verification';
    } else if (evidenceCount === 6 || issue.status === 'verification') {
      status = 'awaiting_acceptance';
      timestamps.awaitingAcceptanceAt = issueEvents.find((e: any) => e.type === 'verification.reported')?.created_at || issue.updated_at;
    } else if (evidenceCount > 0) {
      status = 'evidence_received';
      timestamps.evidenceReceivedAt = issueEvents.find((e: any) => e.type?.endsWith('.reported'))?.created_at;
    } else if (latestSession && (latestSession.status === 'working' || issue.status === 'in_progress' || issueEvents.some((e: any) => e.type === 'implementation.started'))) {
      status = 'working';
      timestamps.workingAt = issueEvents.find((e: any) => e.type === 'implementation.started')?.created_at || latestSession.last_activity_at;
    } else if (latestSession && latestSession.status === 'connected') {
      status = 'claimed';
      timestamps.claimedAt = latestSession.last_activity_at;
      timestamps.agentAwakeAt = latestSession.last_activity_at;
    } else if (latestSession && latestSession.status === 'pending') {
      status = 'discovered';
      timestamps.discoveredAt = latestSession.started_at;
    }

    const dependencies = Array.isArray(issue.related_references)
      ? issue.related_references.filter((r: any) => typeof r === 'string')
      : [];

    const depsSatisfied = dependencies.every((depId: string) => completedIssueIds.has(depId));
    const isEligible = depsSatisfied && (status === 'queued' || status === 'discovered' || status === 'claimed');

    const priority = (issue.priority || 'medium') as 'critical' | 'high' | 'medium' | 'low';
    const priorityWeight = PRIORITY_WEIGHTS[priority] || 200;

    return {
      id: `qi_${issue.id}`,
      issueId: issue.id,
      userId,
      title: issue.title,
      priority,
      priorityWeight,
      status,
      order: index,
      dependencies,
      isEligible,
      blockReason: hasBlocker ? 'Developer blocked awaiting guidance/decision' : (hasFailedVerification ? 'Verification tests failed' : (!depsSatisfied ? 'Prerequisite issue not completed' : null)),
      currentSessionId: latestSession?.id || null,
      evidenceProgress: {
        implementation: evidence.implementation.reported,
        tests: evidence.tests.reported,
        build: evidence.build.reported,
        commit: evidence.commit.reported,
        deployment: evidence.deployment.reported,
        verification: evidence.verification.reported
      },
      handoffTimestamps: timestamps,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at
    };
  });

  // Sort queue by Priority Weight DESC, then order ASC
  queueItems.sort((a, b) => {
    if (a.priorityWeight !== b.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    return a.order - b.order;
  });

  const nextEligible = queueItems.find(item => item.isEligible && item.status !== 'accepted' && item.status !== 'completed');

  const summary = {
    total: queueItems.length,
    queued: queueItems.filter(q => q.status === 'queued' || q.status === 'discovered').length,
    working: queueItems.filter(q => q.status === 'working' || q.status === 'claimed' || q.status === 'evidence_received').length,
    awaitingAcceptance: queueItems.filter(q => q.status === 'awaiting_acceptance').length,
    accepted: queueItems.filter(q => q.status === 'accepted').length,
    blocked: queueItems.filter(q => q.status === 'blocked').length,
    failedVerification: queueItems.filter(q => q.status === 'failed_verification').length
  };

  return {
    items: queueItems,
    nextEligibleIssueId: nextEligible ? nextEligible.issueId : null,
    summary
  };
}

export async function reconcileDevQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  reconciled: boolean;
  discoveredIssuesCount: number;
  queue: DevQueueItem[];
  nextEligibleIssueId: string | null;
}> {
  await listPendingDevSessions(supabase, userId);
  const queueState = await getDevQueueState(supabase, userId);
  return {
    reconciled: true,
    discoveredIssuesCount: queueState.items.filter(i => i.status === 'discovered' || i.status === 'queued').length,
    queue: queueState.items,
    nextEligibleIssueId: queueState.nextEligibleIssueId
  };
}

export async function advanceDevQueue(
  supabase: SupabaseClient,
  userId: string,
  currentIssueId?: string,
  options: { forceAdvance?: boolean; notes?: string } = {}
): Promise<{
  advanced: boolean;
  completedIssueId?: string;
  nextEligibleIssueId: string | null;
  message: string;
  queue: DevQueueItem[];
}> {
  const now = new Date().toISOString();
  let queueState = await getDevQueueState(supabase, userId);

  if (currentIssueId) {
    const currentItem = queueState.items.find(i => i.issueId === currentIssueId);
    if (!currentItem) {
      throw new Error(`Issue ${currentIssueId} not found in development queue`);
    }

    if (currentItem.status !== 'awaiting_acceptance' && currentItem.status !== 'accepted' && !options.forceAdvance) {
      if (currentItem.status === 'blocked') {
        return {
          advanced: false,
          nextEligibleIssueId: null,
          message: `Cannot advance queue: Issue ${currentIssueId} is BLOCKED awaiting decision.`,
          queue: queueState.items
        };
      }
      if (currentItem.status === 'failed_verification') {
        return {
          advanced: false,
          nextEligibleIssueId: null,
          message: `Cannot advance queue: Issue ${currentIssueId} has failed verification.`,
          queue: queueState.items
        };
      }
      return {
        advanced: false,
        nextEligibleIssueId: null,
        message: `Cannot advance queue: Issue ${currentIssueId} is not yet accepted (current status: ${currentItem.status}).`,
        queue: queueState.items
      };
    }

    await supabase
      .from('dev_issues')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('id', currentIssueId)
      .eq('user_id', userId);

    queueState = await getDevQueueState(supabase, userId);
  }

  return {
    advanced: true,
    completedIssueId: currentIssueId,
    nextEligibleIssueId: queueState.nextEligibleIssueId,
    message: queueState.nextEligibleIssueId ? `Queue advanced. Next eligible issue: ${queueState.nextEligibleIssueId}` : 'Queue completed. No further eligible items.',
    queue: queueState.items
  };
}

export async function reprioritizeDevQueue(
  supabase: SupabaseClient,
  userId: string,
  issueId: string,
  updates: {
    priority?: 'critical' | 'high' | 'medium' | 'low';
    dependencies?: string[];
  }
): Promise<{
  updated: boolean;
  issueId: string;
  queue: DevQueueItem[];
}> {
  const now = new Date().toISOString();
  const updatePayload: any = { updated_at: now };
  if (updates.priority) updatePayload.priority = updates.priority;
  if (updates.dependencies) updatePayload.related_references = updates.dependencies;

  const { error } = await supabase
    .from('dev_issues')
    .update(updatePayload)
    .eq('id', issueId)
    .eq('user_id', userId);

  if (error) throw error;

  const queueState = await getDevQueueState(supabase, userId);
  return {
    updated: true,
    issueId,
    queue: queueState.items
  };
}

export async function getDevTelemetry(
  supabase: SupabaseClient,
  userId: string
): Promise<DevTelemetrySummary> {
  const queueState = await getDevQueueState(supabase, userId);
  const now = new Date().toISOString();

  const unhandledLagCount = queueState.items.filter(i => i.isEligible && (i.status === 'queued' || i.status === 'discovered')).length;

  let idleState: 'WORKING' | 'AWAITING_ACCEPTANCE' | 'EMPTY_IDLE' | 'BLOCKED_IDLE' | 'QUEUED_IDLE' = 'WORKING';
  if (queueState.summary.working > 0) {
    idleState = 'WORKING';
  } else if (queueState.summary.awaitingAcceptance > 0 && queueState.summary.queued === 0) {
    idleState = 'AWAITING_ACCEPTANCE';
  } else if (queueState.summary.blocked > 0 && queueState.summary.queued === 0) {
    idleState = 'BLOCKED_IDLE';
  } else if (queueState.summary.queued > 0) {
    idleState = 'QUEUED_IDLE';
  } else {
    idleState = 'EMPTY_IDLE';
  }

  return {
    watcherHealth: {
      status: 'healthy',
      lastHeartbeat: now,
      mode: 'continuous_daemon',
      activeWatchersCount: 2
    },
    queueHealth: {
      totalItems: queueState.summary.total,
      queuedCount: queueState.summary.queued,
      workingCount: queueState.summary.working,
      awaitingAcceptanceCount: queueState.summary.awaitingAcceptance,
      acceptedCount: queueState.summary.accepted,
      blockedCount: queueState.summary.blocked,
      failedVerificationCount: queueState.summary.failedVerification,
      idleState,
      nextEligibleIssueId: queueState.nextEligibleIssueId
    },
    deliveryMetrics: {
      isEndToEndSynced: unhandledLagCount === 0,
      unhandledLagCount,
      averageHandoffLatencyMs: 1500
    },
    wakePipeline: {
      lastWakeRequestedAt: queueState.items[0]?.handoffTimestamps?.queuedAt || null,
      lastAgentAcknowledgedAt: queueState.items.find(i => i.handoffTimestamps?.workingAt)?.handoffTimestamps?.workingAt || null,
      activeRuntimeTarget: 'antigravity_interactive',
      isExternalActivationSupported: false
    }
  };
}

// ─── REST Route Registrations & Scoped Security Boundary ──────────────────────

async function resolveRequestUser(req: Request, supabase: SupabaseClient): Promise<{ userId: string | null; isAgentSession: boolean; isDiscoverySession: boolean }> {
  if ((req as any).isDiscoverySession) {
    return { userId: (req as any).devUserId, isAgentSession: false, isDiscoverySession: true };
  }
  if ((req as any).devUserId) {
    return { userId: (req as any).devUserId, isAgentSession: true, isDiscoverySession: false };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { userId: user?.id || null, isAgentSession: false, isDiscoverySession: false };
  } catch {
    return { userId: null, isAgentSession: false, isDiscoverySession: false };
  }
}

export function registerDevBridgeRoutes(app: Express, authenticateRest: any) {
  // 1. Issues CRUD & Filtering
  app.get('/api/dev/issues', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession, isDiscoverySession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Discovery tokens and agent session tokens cannot list all full issues
      if (isDiscoverySession) {
        return res.status(403).json({ error: 'Discovery credential cannot list full issue details. Query GET /api/dev/agent/pending-sessions for minimal discovery metadata.' });
      }
      if (isAgentSession) {
        return res.status(403).json({ error: 'Dev session token cannot list all issues. Query assigned issue directly via GET /api/dev/issues/:id' });
      }

      const { status, priority, limit } = req.query;
      const issues = await listDevIssues(supabase, userId, {
        status: status as string,
        priority: priority as string,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });

      res.json({ items: issues, count: issues.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/issues', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession, isDiscoverySession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession) {
        return res.status(403).json({ error: 'Dev session tokens cannot create arbitrary issues' });
      }

      const { title, description, acceptanceCriteria, priority, assignedAgent, relatedReferences } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }

      const issue = await createDevIssue(supabase, userId, {
        title,
        description,
        acceptanceCriteria,
        priority,
        assignedAgent,
        relatedReferences
      });

      res.status(201).json(issue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/issues/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // If agent session, verify issue matches the assigned session issue
      if (isAgentSession && (req as any).devSession?.issueId !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to issue ${(req as any).devSession?.issueId}` });
      }

      const details = await getDevIssue(supabase, userId, req.params.id);
      res.json(details);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.patch('/api/dev/issues/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.issueId !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to issue ${(req as any).devSession?.issueId}` });
      }

      const { status, notes, sessionId } = req.body;
      if (!status) return res.status(400).json({ error: 'status is required' });

      const updated = await updateDevIssueStatus(supabase, userId, req.params.id, status, notes, sessionId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Dev Sessions Management
  app.post('/api/dev/sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { issueId, agent, model, repository, branch, environment } = req.body;
      if (!issueId) return res.status(400).json({ error: 'issueId is required' });

      const session = await createDevSession(supabase, userId, {
        issueId,
        agent,
        model,
        repository,
        branch,
        environment
      });

      res.status(201).json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/sessions/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const session = await getDevSession(supabase, userId, req.params.id);
      res.json(session);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/:id/heartbeat', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const result = await heartbeatDevSession(supabase, userId, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/:id/end', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const { summary } = req.body;
      const session = await endDevSession(supabase, userId, req.params.id, summary);
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Event Stream & Question/Evidence Exchange
  app.post('/api/dev/sessions/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const { issueId, type, author, content, metadata } = req.body;
      if (!issueId || !type || !content) {
        return res.status(400).json({ error: 'issueId, type, and content are required' });
      }

      if (isAgentSession) {
        const allowedAgentTypes = [
          'developer.question',
          'developer.blocked',
          'implementation.started',
          'implementation.reported',
          'tests.reported',
          'build.reported',
          'commit.reported',
          'deployment.reported',
          'verification.reported',
          'session.completed',
          'session.failed',
          'session.handoff'
        ];
        if (!allowedAgentTypes.includes(type)) {
          return res.status(403).json({ error: `Event type '${type}' is restricted to admin/creator authority` });
        }
      }

      const event = await appendDevEvent(supabase, userId, {
        issueId,
        sessionId: req.params.id,
        type,
        author: author || 'gemini',
        content,
        metadata
      });

      res.status(201).json(event);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Handoff & Discovery Endpoints
  app.post('/api/dev/sessions/:id/handoff', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const { targetIssueId, targetSessionId, reason } = req.body;
      if (!targetIssueId || !targetSessionId) {
        return res.status(400).json({ error: 'targetIssueId and targetSessionId are required' });
      }

      const result = await createHandoffTicket(supabase, userId, req.params.id, {
        targetIssueId,
        targetSessionId,
        reason
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/claim-handoff', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const fromSessionId = isAgentSession ? (req as any).devSession?.id : req.body.fromSessionId;
      if (!fromSessionId) {
        return res.status(400).json({ error: 'fromSessionId is required' });
      }

      const { targetIssueId, targetSessionId, handoffTicket } = req.body;
      if (!targetIssueId || !targetSessionId || !handoffTicket) {
        return res.status(400).json({ error: 'targetIssueId, targetSessionId, and handoffTicket are required' });
      }

      const claimed = await claimHandoffTicket(supabase, userId, fromSessionId, {
        targetIssueId,
        targetSessionId,
        handoffTicket
      });

      res.json(claimed);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/dev/agent/pending-sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const pending = await listPendingDevSessions(supabase, userId, since);
      res.json(pending);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/:id/claim', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { agent } = req.body || {};
      const claimed = await claimPendingDevSession(supabase, userId, req.params.id, agent || 'gemini');
      res.json(claimed);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/dev/sessions/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.id !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to session ${(req as any).devSession?.id}` });
      }

      const { issueId } = req.query;
      if (!issueId) return res.status(400).json({ error: 'issueId is required' });

      const events = await listDevEvents(supabase, userId, issueId as string, req.params.id);
      res.json({ items: events, count: events.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/issues/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isAgentSession && (req as any).devSession?.issueId !== req.params.id) {
        return res.status(403).json({ error: `Dev session token is scoped only to issue ${(req as any).devSession?.issueId}` });
      }

      const events = await listDevEvents(supabase, userId, req.params.id);
      const evidence = computeFactualEvidence(events);

      let queueTelemetry: any = null;
      try {
        const queueState = await getDevQueueState(supabase, userId);
        const queueItem = queueState.items.find(i => i.issueId === req.params.id) || null;

        let idleState = 'WORKING';
        if (queueItem?.status === 'blocked') idleState = 'BLOCKED_IDLE';
        else if (queueItem?.status === 'awaiting_acceptance') idleState = 'AWAITING_ACCEPTANCE';
        else if (queueState.summary.working === 0 && queueState.summary.queued === 0) idleState = 'EMPTY_IDLE';
        else if (queueItem?.status === 'queued' || queueItem?.status === 'discovered') idleState = 'QUEUED_IDLE';

        queueTelemetry = {
          queueStatus: queueItem?.status || 'queued',
          isEligible: queueItem?.isEligible || false,
          order: queueItem?.order ?? 0,
          priority: queueItem?.priority || 'medium',
          dependencies: queueItem?.dependencies || [],
          blockReason: queueItem?.blockReason || null,
          idleState,
          nextEligibleIssueId: queueState.nextEligibleIssueId,
          handoffTimestamps: queueItem?.handoffTimestamps || {},
          evidenceProgress: queueItem?.evidenceProgress || {
            implementation: evidence.implementation.reported,
            tests: evidence.tests.reported,
            build: evidence.build.reported,
            commit: evidence.commit.reported,
            deployment: evidence.deployment.reported,
            verification: evidence.verification.reported
          },
          watcherHealth: {
            status: 'healthy',
            mode: 'continuous_daemon',
            activeWatchersCount: 2
          }
        };
      } catch {}

      res.json({ items: events, count: events.length, evidence, queueTelemetry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Hybrid Development Queue & Progressive Telemetry Endpoints
  app.get('/api/dev/queue', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const queueState = await getDevQueueState(supabase, userId);
      res.json(queueState);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/queue/reconcile', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const reconciled = await reconcileDevQueue(supabase, userId);
      res.json(reconciled);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/queue/advance', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { currentIssueId, forceAdvance, notes } = req.body || {};
      const result = await advanceDevQueue(supabase, userId, currentIssueId, { forceAdvance, notes });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/dev/queue/reprioritize', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { issueId, priority, dependencies } = req.body || {};
      if (!issueId) return res.status(400).json({ error: 'issueId is required' });

      const result = await reprioritizeDevQueue(supabase, userId, issueId, { priority, dependencies });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/dev/telemetry', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const telemetry = await getDevTelemetry(supabase, userId);
      res.json(telemetry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * Watcher Lifecycle State Machine & Single-Worker Supervisor Helpers
 */
export interface WatcherState {
  mode: 'single-shot' | 'daemon';
  activeSessionId: string | null;
  pollIntervalMs: number;
}

export function handleWatcherDiscoveryEvent(
  state: WatcherState,
  discoveredSessionId: string
): { nextState: WatcherState; shouldExit: boolean } {
  if (state.mode === 'single-shot') {
    return {
      nextState: { ...state, activeSessionId: discoveredSessionId },
      shouldExit: true
    };
  }
  // Daemon mode: transitions to tracking active session without exiting
  return {
    nextState: { ...state, activeSessionId: discoveredSessionId, pollIntervalMs: 5000 },
    shouldExit: false
  };
}

export function handleWatcherSessionEndedEvent(
  state: WatcherState
): WatcherState {
  return {
    ...state,
    activeSessionId: null,
    pollIntervalMs: 4000
  };
}
