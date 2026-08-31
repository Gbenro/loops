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

  return {
    issue,
    latestSession,
    evidence
  };
}

export async function createDevIssue(
  supabase: SupabaseClient,
  userId: string,
  params: {
    title: string;
    description: string;
    acceptanceCriteria?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignedAgent?: string;
    relatedReferences?: any[];
  }
): Promise<DevIssue> {
  const id = generateId('iss');
  const now = new Date().toISOString();

  const insertData = {
    id,
    user_id: userId,
    title: params.title,
    description: params.description,
    acceptance_criteria: params.acceptanceCriteria || [],
    status: 'proposed',
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
  }
): Promise<DevSession> {
  const id = generateId('sess');
  const now = new Date().toISOString();
  const token = 'dtk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const insertData = {
    id,
    issue_id: params.issueId,
    user_id: userId,
    agent: params.agent || 'gemini',
    model: params.model || null,
    status: 'connected',
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
  userId: string
): Promise<{ items: Array<{ id: string; issueId: string; agent: string; startedAt: string; status: string }> }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('dev_sessions')
    .select('id, issue_id, agent, status, started_at')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .gt('token_expires_at', now)
    .order('started_at', { ascending: false });

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

  // Update session last_activity_at and extend token
  const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await supabase
    .from('dev_sessions')
    .update({ last_activity_at: now, token_expires_at: tokenExpiresAt })
    .eq('id', params.sessionId)
    .eq('user_id', userId);

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

// ─── REST Route Registrations & Scoped Security Boundary ──────────────────────

async function resolveRequestUser(req: Request, supabase: SupabaseClient): Promise<{ userId: string | null; isAgentSession: boolean }> {
  if ((req as any).devUserId) {
    return { userId: (req as any).devUserId, isAgentSession: true };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { userId: user?.id || null, isAgentSession: false };
  } catch {
    return { userId: null, isAgentSession: false };
  }
}

export function registerDevBridgeRoutes(app: Express, authenticateRest: any) {
  // 1. Issues CRUD & Filtering
  app.get('/api/dev/issues', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Agents with ephemeral tokens cannot list all issues; they only access their assigned issue
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
      const { userId, isAgentSession } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Agents cannot create arbitrary issues; creator/admin capability only
      if (isAgentSession) {
        return res.status(403).json({ error: 'Dev session token cannot create arbitrary issues' });
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
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const pending = await listPendingDevSessions(supabase, userId);
      res.json(pending);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

      res.json({ items: events, count: events.length, evidence });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
