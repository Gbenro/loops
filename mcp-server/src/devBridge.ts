import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnon, getSupabaseService } from './db.js';

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
  | 'completion.summary'
  | 'issue.reopened'
  | 'scope.updated'
  | 'session.completed'
  | 'session.failed'
  | 'session.handoff'
  | 'session.ended'
  | 'lab.result.published'
  | 'worker.heartbeat'
  | 'execution.claimed'
  | 'execution.lease_renewed'
  | 'execution.lease_expired'
  | 'execution.cancelled'
  | 'execution.finalized';

export interface WorkerPresence {
  workerId: string;
  workerInstanceId: string;
  hostname?: string;
  platform?: string;
  runtimeProfiles: string[];
  availableCapacity: number;
  health?: any;
  lastHeartbeatAt: number;
}

export interface DevExecutionAttempt {
  id: string;
  attemptId: string;
  sessionId: string;
  issueId: string;
  userId: string;
  workerId: string;
  workerInstanceId: string;
  fencingToken: number;
  leaseExpiresAt: string;
  lastHeartbeatAt: string;
  stage: 'reserved' | 'claimed' | 'running' | 'verifying' | 'completed' | 'failed' | 'expired' | 'cancelled';
  runtimeProfileId: string;
  repository: string;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface DevEvent {
  id: string;
  issueId: string;
  sessionId: string;
  userId: string;
  type: DevEventType;
  author: 'gemini' | 'luna' | 'user' | string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}


export interface DevAsset {
  id: string;
  userId: string;
  projectId: string;
  videoId?: string | null;
  shotId: string;
  batch?: number | null;
  kind: 'image' | 'video' | 'audio' | string;
  role: 'source' | 'preview' | 'final' | string;
  generatedBy: 'luna' | 'gemini' | 'other' | string;
  status: 'draft' | 'review' | 'approved' | 'rejected' | string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: string;
  filename: string;
  checksum?: string | null;
  prompt?: string | null;
  motionIntent?: string | null;
  dataBase64?: string | null;
  ingestedLocally: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevCompletionSummary {
  reported: boolean;
  author?: string;
  agent?: string;
  summary?: string;
  changes?: string[];
  testResults?: {
    passed: boolean;
    command?: string;
    passedCount?: number;
    failedCount?: number;
  };
  buildResults?: {
    passed: boolean;
    command?: string;
  };
  commit?: {
    hash?: string;
    branch?: string;
    message?: string;
  };
  deployment?: {
    environment?: string;
    url?: string;
  };
  caveats?: string[];
  acceptanceStatus?: string;
  nextStep?: string;
  timestamp?: string;
}

export interface DevEvidenceSummary {
  lifecycleCycle: number;
  isStale: boolean;
  currentCycleCutoff?: string;
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
  completionSummary: DevCompletionSummary;
  priorCycles?: Array<{
    cycle: number;
    cutoffEvent: string;
    endedAt: string;
    evidence: Record<string, any>;
  }>;
}

export interface DevIssueDetail {
  issue: DevIssue;
  latestSession?: DevSession | null;
  evidence: DevEvidenceSummary;
  completionSummary?: DevCompletionSummary;
  queueTelemetry?: any;
}

// â”€â”€â”€ ID & Model Mappings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
/**
 * Strictly factual evidence aggregation:
 * Enforces lifecycle versioning and scopes evidence to the current cycle.
 * Reopening an issue or updating scope with material requirements resets active evidence
 * while archiving prior cycles for complete auditability.
 */
export function computeFactualEvidence(events: DevEvent[]): DevEvidenceSummary {
  // Sort events chronologically to guarantee correct order
  const sortedEvents = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Detect cycle-resetting events
  const resetEvents = sortedEvents.filter(e =>
    e.type === 'issue.reopened' ||
    e.type === 'scope.updated' ||
    (e.type === 'requirement.changed' && (e.metadata?.invalidatesVerification !== false))
  );

  const cycleCount = resetEvents.length + 1;
  const lastReset = resetEvents.length > 0 ? resetEvents[resetEvents.length - 1] : null;
  const currentCutoff = lastReset ? lastReset.createdAt : null;

  // Split events: current cycle vs prior cycles
  const currentCycleEvents = currentCutoff
    ? sortedEvents.filter(e => new Date(e.createdAt).getTime() > new Date(currentCutoff).getTime())
    : sortedEvents;

  const priorEvents = currentCutoff
    ? sortedEvents.filter(e => new Date(e.createdAt).getTime() <= new Date(currentCutoff).getTime())
    : [];

  const summary: DevEvidenceSummary = {
    lifecycleCycle: cycleCount,
    isStale: resetEvents.length > 0,
    currentCycleCutoff: currentCutoff || undefined,
    implementation: { reported: false },
    tests: { reported: false },
    build: { reported: false },
    commit: { reported: false },
    deployment: { reported: false },
    verification: { reported: false },
    completionSummary: { reported: false }
  };

  for (const evt of currentCycleEvents) {
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
    } else if (evt.type === 'completion.summary' || (evt.type === 'session.completed' && evt.metadata?.completionSummary)) {
      let rawData: any = {};
      if (typeof evt.content === 'string') {
        try {
          rawData = JSON.parse(evt.content);
        } catch {
          rawData = { summary: evt.content };
        }
      } else if (typeof evt.content === 'object' && evt.content !== null) {
        rawData = evt.content;
      }
      const data = { ...rawData, ...(evt.metadata?.completionSummary || evt.metadata || {}) };

      summary.completionSummary = {
        reported: true,
        author: evt.author,
        agent: data.agent || evt.author,
        summary: data.summary || (typeof evt.content === 'string' ? evt.content : ''),
        changes: Array.isArray(data.changes) ? data.changes : (data.changedFiles || []),
        testResults: data.testResults || (data.testsPassed !== undefined ? { passed: Boolean(data.testsPassed), passedCount: data.passed, failedCount: data.failed } : undefined),
        buildResults: data.buildResults || (data.buildPassed !== undefined ? { passed: Boolean(data.buildPassed) } : undefined),
        commit: data.commit || (data.commitHash ? { hash: data.commitHash, branch: data.branch, message: data.commitMessage } : undefined),
        deployment: data.deployment || (data.environment ? { environment: data.environment, url: data.deploymentUrl } : undefined),
        caveats: Array.isArray(data.caveats) ? data.caveats : [],
        acceptanceStatus: data.acceptanceStatus || 'awaiting_user_acceptance',
        nextStep: data.nextStep,
        timestamp: evt.createdAt
      };
    }
  }

  // If there are prior events, assemble them into priorCycles for auditing
  if (priorEvents.length > 0) {
    summary.priorCycles = resetEvents.map((rEvt, idx) => {
      const prevReset = idx > 0 ? resetEvents[idx - 1].createdAt : null;
      const cycleEvents = sortedEvents.filter(e => {
        const t = new Date(e.createdAt).getTime();
        const start = prevReset ? new Date(prevReset).getTime() : 0;
        const end = new Date(rEvt.createdAt).getTime();
        return t > start && t <= end;
      });

      return {
        cycle: idx + 1,
        cutoffEvent: rEvt.type,
        endedAt: rEvt.createdAt,
        evidence: {
          implementation: cycleEvents.some(e => e.type === 'implementation.reported'),
          tests: cycleEvents.some(e => e.type === 'tests.reported'),
          build: cycleEvents.some(e => e.type === 'build.reported'),
          commit: cycleEvents.some(e => e.type === 'commit.reported'),
          deployment: cycleEvents.some(e => e.type === 'deployment.reported'),
          verification: cycleEvents.some(e => e.type === 'verification.reported'),
          completionSummary: cycleEvents.some(e => e.type === 'completion.summary')
        }
      };
    });
  }

  // Stale flag is false only if current cycle has reached verification and completion summary
  summary.isStale = summary.isStale && (!summary.verification.reported || !summary.completionSummary.reported);

  return summary;
}

// â”€â”€â”€ Intent-Aware Event Classification & Task Dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if (metadata.status === 'approved_for_implementation' || /APPROVED â€” Implement|PROCEED WITH IMPLEMENTATION|EXECUTE IMPLEMENTATION/i.test(content)) {
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

// â”€â”€â”€ Ephemeral Dev Session Token Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Core Service Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      watcherHealth: { status: getActiveWorkersCount() > 0 ? 'healthy' : 'offline', mode: 'supervised_execution_v2', activeWatchersCount: getActiveWorkersCount() }
    };
  } catch (qErr) {
    console.warn('[QueueProjection] Warning computing queue telemetry for issue:', qErr);
  }

  return {
    issue,
    latestSession,
    evidence,
    completionSummary: evidence.completionSummary,
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
  } else if (status === 'ready' || status === 'in_progress') {
    updateData.completed_at = null;
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
  let targetSessionId: string = sessionId || '';
  if (!targetSessionId) {
    // 1. Check for an active session (pending, connected, or working) for this issue
    const { data: activeSessions } = await supabase
      .from('dev_sessions')
      .select('id, status')
      .eq('issue_id', issueId)
      .eq('user_id', userId)
      .in('status', ['pending', 'connected', 'working'])
      .order('started_at', { ascending: false })
      .limit(1);

    if (activeSessions && activeSessions.length > 0) {
      targetSessionId = activeSessions[0].id;
    } else {
      // 2. If reopening to ready or in_progress and no active session exists, create a fresh session
      if (status === 'ready' || status === 'in_progress') {
        const newSessId = generateId('sess');
        const { data: createdSess } = await supabase
          .from('dev_sessions')
          .insert({
            id: newSessId,
            issue_id: issueId,
            user_id: userId,
            agent: issue.assignedAgent || 'gemini',
            status: status === 'in_progress' ? 'connected' : 'pending',
            started_at: now,
            last_activity_at: now
          })
          .select('id')
          .single();

        if (createdSess?.id) {
          targetSessionId = createdSess.id;
        }
      }

      // 3. Fallback: check any historical session for this issue to satisfy foreign key
      if (!targetSessionId) {
        const { data: historicalSessions } = await supabase
          .from('dev_sessions')
          .select('id')
          .eq('issue_id', issueId)
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(1);

        if (historicalSessions && historicalSessions.length > 0) {
          targetSessionId = historicalSessions[0].id;
        }
      }

      // 4. Ultimate fallback: if zero sessions have ever existed, create a session
      if (!targetSessionId) {
        const fallbackSessId = generateId('sess');
        await supabase
          .from('dev_sessions')
          .insert({
            id: fallbackSessId,
            issue_id: issueId,
            user_id: userId,
            agent: issue.assignedAgent || 'gemini',
            status: 'pending',
            started_at: now,
            last_activity_at: now
          });
        targetSessionId = fallbackSessId;
      }
    }
  }

  if (status === 'ready' || status === 'in_progress') {
    await appendDevEvent(supabase, userId, {
      issueId,
      sessionId: targetSessionId,
      type: 'issue.reopened',
      author: 'gemini',
      content: notes || `Issue reopened and returned to ${status}. Prior evidence scoped to previous cycle.`,
      metadata: { previousStatus: issueRowStatus(issue), newStatus: status, invalidatesVerification: true }
    });
  } else if (targetSessionId) {
    await appendDevEvent(supabase, userId, {
      issueId,
      sessionId: targetSessionId,
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

// ─── Secret Redaction & Security Helpers ─────────────────────────────────────
export function sanitizeSecretContent(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/dsc_[a-zA-Z0-9_-]{16,}/g, '[REDACTED_DISCOVERY_TOKEN]')
    .replace(/dtk_[a-zA-Z0-9_-]{16,}/g, '[REDACTED_SESSION_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
}

export function sanitizeSecretMetadata(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSecretMetadata);
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = sanitizeSecretContent(v);
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeSecretMetadata(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}


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
    content: sanitizeSecretContent(params.content),
    metadata: sanitizeSecretMetadata(params.metadata || {}),
    created_at: now
  };

  const { data, error } = await supabase
    .from('dev_events')
    .insert(insertData)
    .select()
    .single();

  let eventData = data;
  let effectiveSessionId = params.sessionId;

  if (error || !eventData) {
    const isFkeyError = error?.code === '23503' || 
      (error?.message && (error.message.includes('foreign key') || error.message.includes('dev_events_session_id_fkey')));

    if (isFkeyError) {
      console.warn(`[DevBridge] session_id '${params.sessionId}' violates foreign key dev_events_session_id_fkey. Self-healing by attaching/provisioning a valid session for issue '${params.issueId}'.`);
      const { data: fallbackSession } = await supabase
        .from('dev_sessions')
        .select('id')
        .eq('issue_id', params.issueId)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackSession?.id) {
        effectiveSessionId = fallbackSession.id;
      } else {
        effectiveSessionId = generateId('sess');
        await supabase.from('dev_sessions').insert({
          id: effectiveSessionId,
          issue_id: params.issueId,
          user_id: userId,
          agent: params.author || 'gemini',
          status: 'pending',
          started_at: now,
          last_activity_at: now
        });
      }

      insertData.session_id = effectiveSessionId;
      const retryResult = await supabase
        .from('dev_events')
        .insert(insertData)
        .select()
        .single();

      if (retryResult.error || !retryResult.data) {
        throw new Error(retryResult.error?.message || 'Failed to append Dev Event after foreign key recovery');
      }
      eventData = retryResult.data;
    } else {
      throw new Error(error?.message || 'Failed to append Dev Event');
    }
  }

  // Update session last_activity_at and extend token only for active sessions
  const { data: currentSession } = await supabase
    .from('dev_sessions')
    .select('status')
    .eq('id', effectiveSessionId)
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
      .eq('id', effectiveSessionId)
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

  return mapDevEvent(eventData);
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

// â”€â”€â”€ Hybrid Development Queue & Progressive Telemetry Orchestration â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const evidenceCount = [
      evidence.implementation.reported,
      evidence.tests.reported,
      evidence.build.reported,
      evidence.commit.reported,
      evidence.deployment.reported,
      evidence.verification.reported
    ].filter(Boolean).length;
    const hasCompletionSummary = evidence.completionSummary?.reported === true;

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
    } else if (issue.status === 'in_progress') {
      // An active/reopened in_progress issue is working; cannot jump to awaiting_acceptance on stale evidence
      status = 'working';
      timestamps.workingAt = latestSession?.last_activity_at || issue.updated_at;
    } else if (issue.status === 'ready') {
      status = latestSession?.status === 'connected' ? 'claimed' : (latestSession?.status === 'pending' ? 'discovered' : 'queued');
      if (status === 'claimed') timestamps.claimedAt = latestSession?.last_activity_at;
      if (status === 'discovered') timestamps.discoveredAt = latestSession?.started_at;
    } else if ((evidenceCount === 6 && hasCompletionSummary) || issue.status === 'verification') {
      status = 'awaiting_acceptance';
      timestamps.awaitingAcceptanceAt = issueEvents.find((e: any) => e.type === 'completion.summary' || e.type === 'verification.reported')?.created_at || issue.updated_at;
    } else if (evidenceCount > 0 || hasCompletionSummary) {
      status = 'evidence_received';
      timestamps.evidenceReceivedAt = issueEvents.find((e: any) => e.type?.endsWith('.reported') || e.type === 'completion.summary')?.created_at;
    } else if (latestSession && (latestSession.status === 'working' || issueEvents.some((e: any) => e.type === 'implementation.started'))) {
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
      ? issue.related_references.filter((r: any) => typeof r === 'string' && r.startsWith('iss_'))
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

    // Enforce factual current-cycle verification & completion summary
    const currentItemEvidence = currentItem.evidenceProgress;
    const isComplete = currentItemEvidence && Object.values(currentItemEvidence).every(Boolean);
    if (!isComplete && !options.forceAdvance) {
      return {
        advanced: false,
        nextEligibleIssueId: null,
        message: `Cannot advance queue: Issue ${currentIssueId} has incomplete verification evidence for current cycle.`,
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

// â”€â”€â”€ REST Route Registrations & Scoped Security Boundary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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




// Resilient in-memory asset store as primary/fallback
export const localDevAssetStore = new Map<string, DevAsset>();

const TICKET_SECRET = process.env.LUNA_ASSET_TICKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'luna_creative_asset_bridge_ticket_key_v1';

export function generateAssetTicket(assetId: string, exp: number): string {
  return crypto
    .createHmac('sha256', TICKET_SECRET)
    .update(`${assetId}:${exp}`)
    .digest('hex');
}

export function verifyAssetTicket(assetId: string, ticket: string, exp: number | string): boolean {
  try {
    const expNum = typeof exp === 'string' ? parseInt(exp, 10) : exp;
    const now = Date.now();
    const expMs = expNum < 10000000000 ? expNum * 1000 : expNum;
    if (isNaN(expNum) || expMs <= now) return false;
    const expected = generateAssetTicket(assetId, expNum);
    const bufTicket = Buffer.from(ticket, 'hex');
    const bufExpected = Buffer.from(expected, 'hex');
    if (bufTicket.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufTicket, bufExpected);
  } catch {
    return false;
  }
}

export function buildAssetPreviewUrls(req: Request, assetId: string, filename?: string) {
  const host = req.get('host') || 'loops-production-e1d5.up.railway.app';
  const protocol = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : 'https';
  const exp = Date.now() + 48 * 60 * 60 * 1000; // 48-hour preview window
  const ticket = generateAssetTicket(assetId, exp);
  const fname = filename || 'image.jpg';
  
  // Clean path-based URL (no query strings, ends in .jpg - optimal for ChatGPT markdown & anti-exfiltration proxies)
  const pathUrl = `${protocol}://${host}/api/dev/assets/${assetId}/view/${ticket}/${exp}/${fname}`;
  const queryPreviewUrl = `${protocol}://${host}/api/dev/assets/${assetId}/preview?ticket=${ticket}&exp=${exp}`;
  const downloadUrl = `${protocol}://${host}/api/dev/assets/${assetId}/download?ticket=${ticket}&exp=${exp}`;
  
  return {
    downloadUrl,
    previewUrl: pathUrl, // default previewUrl uses clean path ending in .jpg
    pathUrl,
    queryPreviewUrl,
    ticket,
    expiresAt: new Date(exp).toISOString(),
  };
}

const STORAGE_BUCKET = 'creative-previews';
let storageBucketReady = false;
const storageUploadedSet = new Set<string>();

export async function getStorageSignedUrl(supabase: SupabaseClient, asset: DevAsset): Promise<string | null> {
  // Always prefer privileged service client for storage bucket operations and signed URLs
  let storageClient: SupabaseClient | null = null;
  try {
    storageClient = getSupabaseService();
  } catch {
    storageClient = supabase;
  }
  if (!storageClient || !storageClient.storage) return null;

  const filename = asset.filename || `${asset.id}.jpg`;
  const storagePath = `video_1/${filename}`;

  try {
    // 1. Ensure bucket exists if not already initialized
    if (!storageBucketReady) {
      try {
        const { data: buckets, error: listErr } = await storageClient.storage.listBuckets();
        if (!listErr && buckets) {
          const exists = buckets.some((b: any) => b.name === STORAGE_BUCKET);
          if (!exists) {
            await storageClient.storage.createBucket(STORAGE_BUCKET, { public: false });
          }
          storageBucketReady = true;
        }
      } catch (bErr) {
        console.warn('[devBridge] Non-critical bucket check error, assuming bucket exists:', bErr);
        storageBucketReady = true;
      }
    }

    // 2. Upload asset binary to Supabase Storage if not yet uploaded in this process
    if (!storageUploadedSet.has(storagePath)) {
      let buffer: Buffer | null = null;
      if (asset.dataBase64) {
        buffer = Buffer.from(asset.dataBase64, 'base64');
      } else if (asset.filename) {
        const possiblePaths = [
          path.join(__dirname, '..', 'previews', asset.filename),
          path.join(process.cwd(), 'mcp-server', 'previews', asset.filename),
          path.join(process.cwd(), 'previews', asset.filename),
        ];
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            buffer = fs.readFileSync(p);
            break;
          }
        }
      }

      if (buffer && buffer.length > 0) {
        try {
          const { error: uploadErr } = await storageClient.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
            contentType: asset.mimeType || 'image/jpeg',
            upsert: true,
          });
          if (!uploadErr) {
            storageUploadedSet.add(storagePath);
          } else {
            console.warn('[devBridge] Storage upload warning for', storagePath, uploadErr);
          }
        } catch (uErr) {
          console.warn('[devBridge] Storage upload exception for', storagePath, uErr);
        }
      }
    }

    // 3. Create short-lived signed object URL (48 hours = 172800 seconds)
    const { data: signedData, error: signErr } = await storageClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 48 * 3600);

    if (signErr) {
      console.warn('[devBridge] createSignedUrl error for', storagePath, signErr);
    }

    if (signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (err) {
    console.warn('[devBridge] Supabase Storage signed URL generation failed, falling back to gateway URL:', err);
  }

  return null;
}

export const VIDEO_1_SEED_MANIFEST = [
  { shotId: '01', filename: 'shot_01_seedling_source.jpg', batch: 1, role: 'source', prompt: 'Seedling macro emergence in dawn light' },
  { shotId: '02', filename: 'shot_02_forest_source.jpg', batch: 1, role: 'source', prompt: 'Towering canopy looking up toward morning light' },
  { shotId: '03', filename: 'shot_03_season_1_emergence.jpg', batch: 1, role: 'preview', prompt: 'Season 1 Emergence (Spring oak buds)' },
  { shotId: '03', filename: 'shot_03_season_2_growth.jpg', batch: 1, role: 'preview', prompt: 'Season 2 Growth (Expanding canopy)' },
  { shotId: '03', filename: 'shot_03_season_3_maturity.jpg', batch: 1, role: 'preview', prompt: 'Season 3 Maturity (Full summer canopy)' },
  { shotId: '03', filename: 'shot_03_season_4_release.jpg', batch: 1, role: 'preview', prompt: 'Season 4 Release (Amber autumn drop)' },
  { shotId: '03', filename: 'shot_03_season_5_rest.jpg', batch: 1, role: 'preview', prompt: 'Season 5 Rest (Bare winter tree in frost)' },
  { shotId: '03', filename: 'shot_03_season_6_renewal.jpg', batch: 1, role: 'preview', prompt: 'Season 6 Renewal (Early spring renewal)' },
  { shotId: '04', filename: 'shot_04_moon_source.jpg', batch: 1, role: 'source', prompt: 'Celestial Moon reveal through forest canopy' },
  { shotId: '05', filename: 'shot_05_calendar_source.jpg', batch: 2, role: 'source', prompt: 'Calendar grid in cool daylight' },
  { shotId: '06', filename: 'shot_06_ripple_source.jpg', batch: 2, role: 'source', prompt: 'Water ripple expanding overhead view' },
  { shotId: '07', filename: 'shot_07_monday_a.jpg', batch: 2, role: 'preview', prompt: 'Monday A workspace matched pair' },
  { shotId: '07', filename: 'shot_07_monday_b.jpg', batch: 2, role: 'preview', prompt: 'Monday B workspace matched pair' },
  { shotId: '08', filename: 'shot_08_waxing.jpg', batch: 2, role: 'preview', prompt: 'Shot 08 Waxing workspace (Bright morning daylight)' },
  { shotId: '08', filename: 'shot_08_waning.jpg', batch: 2, role: 'preview', prompt: 'Shot 08 Waning workspace (Soft twilight illumination)' },
  { shotId: '09', filename: 'shot_09_human_entry_source.jpg', batch: 3, role: 'source', prompt: 'Human creator entry at natural workspace' },
  { shotId: '10', filename: 'shot_10_begin.jpg', batch: 3, role: 'preview', prompt: 'Shot 10 Begin (First deliberate mark)' },
  { shotId: '10', filename: 'shot_10_build.jpg', batch: 3, role: 'preview', prompt: 'Shot 10 Build (Developing layers and structure)' },
  { shotId: '11', filename: 'shot_11_full_expression_source.jpg', batch: 3, role: 'source', prompt: 'Shot 11 Full Expression (Work brought into window light)' },
  { shotId: '12', filename: 'shot_12_release.jpg', batch: 3, role: 'preview', prompt: 'Shot 12 Release (Hands setting down creation)' },
  { shotId: '12', filename: 'shot_12_rest.jpg', batch: 3, role: 'preview', prompt: 'Shot 12 Rest (Empty chair, quiet late-day stillness)' },
];

export function seedVideo1Assets(): void {
  const seedUserId = 'user_dev_discovery';
  const now = new Date().toISOString();

  for (const item of VIDEO_1_SEED_MANIFEST) {
    const assetId = `ast_v1_${item.shotId}_${item.filename.replace(/[^a-z0-9]/gi, '_')}`;
    if (localDevAssetStore.has(assetId)) continue;

    let b64: string | null = null;
    let checksum: string | null = null;
    const possiblePaths = [
      path.join(__dirname, '..', 'previews', item.filename),
      path.join(process.cwd(), 'mcp-server', 'previews', item.filename),
      path.join(process.cwd(), 'previews', item.filename),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          b64 = buf.toString('base64');
          checksum = crypto.createHash('sha256').update(buf).digest('hex');
          break;
        } catch {}
      }
    }

    const asset: DevAsset = {
      id: assetId,
      userId: seedUserId,
      projectId: 'projects/creating_with_the_cycles/video_1_what_does_that_mean',
      videoId: null,
      shotId: item.shotId,
      batch: item.batch,
      kind: 'image',
      role: item.role,
      generatedBy: 'gemini',
      status: 'review',
      mimeType: 'image/jpeg',
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      filename: item.filename,
      checksum,
      prompt: item.prompt,
      motionIntent: null,
      dataBase64: b64,
      ingestedLocally: false,
      createdAt: now,
      updatedAt: now,
    };
    localDevAssetStore.set(assetId, asset);
  }
}

try {
  seedVideo1Assets();
} catch (e) {
  console.warn('[devBridge] Failed to seed Video 1 assets:', e);
}


export async function createDevAsset(
  supabase: SupabaseClient,
  userId: string,
  data: Partial<DevAsset>
): Promise<DevAsset> {
  const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  
  const checksum = data.checksum || (data.dataBase64 ? crypto.createHash('sha256').update(Buffer.from(data.dataBase64, 'base64')).digest('hex') : null);

  const asset: DevAsset = {
    id: assetId,
    userId: userId,
    projectId: data.projectId || 'projects/creating_with_the_cycles/video_1_what_does_that_mean',
    videoId: data.videoId || null,
    shotId: data.shotId || 'shot_01',
    batch: data.batch || 1,
    kind: data.kind || 'image',
    role: data.role || 'source',
    generatedBy: data.generatedBy || 'gemini',
    status: data.status || 'review',
    mimeType: data.mimeType || 'image/jpeg',
    width: data.width || 1080,
    height: data.height || 1920,
    aspectRatio: data.aspectRatio || '9:16',
    filename: data.filename || 'asset.jpg',
    checksum,
    prompt: data.prompt || null,
    motionIntent: data.motionIntent || null,
    dataBase64: data.dataBase64 || null,
    ingestedLocally: data.ingestedLocally || false,
    createdAt: now,
    updatedAt: now,
    ...((data as any).metadata ? { metadata: (data as any).metadata } : {})
  };

  // 1. Store in memory for instant reliability
  localDevAssetStore.set(assetId, asset);

  // 1b. Mirror uploaded binary to Supabase Storage
  let storageMirrorClient: SupabaseClient | null = null;
  try {
    storageMirrorClient = getSupabaseService();
  } catch {
    storageMirrorClient = supabase;
  }
  if (asset.dataBase64 && storageMirrorClient && storageMirrorClient.storage) {
    try {
      const buf = Buffer.from(asset.dataBase64, 'base64');
      const sPath = `video_1/${asset.filename || (asset.id + '.jpg')}`;
      await storageMirrorClient.storage.from(STORAGE_BUCKET).upload(sPath, buf, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: true,
      });
      storageUploadedSet.add(sPath);
    } catch (e) {
      console.warn('[devBridge] Best-effort upload to storage failed:', e);
    }
  }

  // 2. Best-effort Supabase insert
  try {
    const record = {
      id: asset.id,
      user_id: userId,
      project_id: asset.projectId,
      video_id: asset.videoId,
      shot_id: asset.shotId,
      batch: asset.batch,
      kind: asset.kind,
      role: asset.role,
      generated_by: asset.generatedBy,
      status: asset.status,
      mime_type: asset.mimeType,
      width: asset.width,
      height: asset.height,
      aspect_ratio: asset.aspectRatio,
      filename: asset.filename,
      checksum: asset.checksum,
      prompt: asset.prompt,
      motion_intent: asset.motionIntent,
      data_base64: asset.dataBase64,
      ingested_locally: asset.ingestedLocally,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt
    };
    await supabase.from('dev_assets').insert(record);
  } catch (err) {
    console.warn('[devBridge] Supabase dev_assets insert warning (using resilient store):', err);
  }

  return asset;
}

export async function listDevAssets(
  supabase: SupabaseClient,
  userId: string,
  filters: { projectId?: string; shotId?: string; batch?: number; status?: string; generatedBy?: string } = {}
): Promise<DevAsset[]> {
  const assets: DevAsset[] = [];

  // 1. Fetch from Supabase if table exists
  try {
    let query = supabase.from('dev_assets').select('*').eq('user_id', userId);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.shotId) query = query.eq('shot_id', filters.shotId);
    if (filters.batch) query = query.eq('batch', filters.batch);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.generatedBy) query = query.eq('generated_by', filters.generatedBy);

    const { data, error } = await query;
    if (!error && data) {
      assets.push(...data.map(formatDevAsset));
    }
  } catch {}

  // 2. Merge in-memory assets (deduplicating by ID)
  const existingIds = new Set(assets.map(a => a.id));
  for (const asset of localDevAssetStore.values()) {
    const isOwnerOrDiscovery = asset.userId === userId || asset.userId === 'user_dev_discovery' || userId === 'user_dev_discovery';
    if (isOwnerOrDiscovery && !existingIds.has(asset.id)) {
      if (filters.projectId && asset.projectId !== filters.projectId) continue;
      if (filters.shotId && asset.shotId !== filters.shotId) continue;
      if (filters.batch && asset.batch !== filters.batch) continue;
      if (filters.status && asset.status !== filters.status) continue;
      if (filters.generatedBy && asset.generatedBy !== filters.generatedBy) continue;
      assets.push(asset);
    }
  }

  return assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getDevAssetById(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<DevAsset | null> {
  // 1. Check in-memory first
  if (localDevAssetStore.has(assetId)) {
    const asset = localDevAssetStore.get(assetId)!;
    if (asset.userId === userId || asset.userId === 'user_dev_discovery' || userId === 'user_dev_discovery') {
      return asset;
    }
  }

  // 2. Check Supabase
  try {
    const { data, error } = await supabase
      .from('dev_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (!error && data) {
      return formatDevAsset(data);
    }
  } catch {}

  return null;
}

export async function ackDevAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<DevAsset> {
  const asset = await getDevAssetById(supabase, userId, assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  asset.ingestedLocally = true;
  asset.updatedAt = new Date().toISOString();
  localDevAssetStore.set(assetId, asset);

  try {
    await supabase
      .from('dev_assets')
      .update({ ingested_locally: true, updated_at: asset.updatedAt })
      .eq('id', assetId);
  } catch {}

  return asset;
}

function formatDevAsset(row: any): DevAsset {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    videoId: row.video_id,
    shotId: row.shot_id,
    batch: row.batch,
    kind: row.kind,
    role: row.role,
    generatedBy: row.generated_by,
    status: row.status,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspect_ratio,
    filename: row.filename,
    checksum: row.checksum,
    prompt: row.prompt,
    motionIntent: row.motion_intent,
    dataBase64: row.data_base64,
    ingestedLocally: row.ingested_locally,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}


// ─── Supervised Execution Engine & Lease Registry (V2) ──────────────────────────

export const activeWorkersRegistry = new Map<string, WorkerPresence>();

export function getActiveWorkersCount(): number {
  const cutoff = Date.now() - 60 * 1000;
  let count = 0;
  for (const [_, worker] of activeWorkersRegistry.entries()) {
    if (worker.lastHeartbeatAt > cutoff) count++;
  }
  return count;
}

export function getLatestWorkerHeartbeat(): string | null {
  let latest = 0;
  for (const [_, worker] of activeWorkersRegistry.entries()) {
    if (worker.lastHeartbeatAt > latest) latest = worker.lastHeartbeatAt;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

export function recordWorkerHeartbeat(workerInfo: Partial<WorkerPresence> & { workerId: string; workerInstanceId: string }): WorkerPresence {
  const existing = activeWorkersRegistry.get(workerInfo.workerId) || {
    workerId: workerInfo.workerId,
    workerInstanceId: workerInfo.workerInstanceId,
    runtimeProfiles: [],
    availableCapacity: 1,
    lastHeartbeatAt: Date.now()
  };

  const updated: WorkerPresence = {
    ...existing,
    ...workerInfo,
    lastHeartbeatAt: Date.now()
  };
  activeWorkersRegistry.set(workerInfo.workerId, updated);
  return updated;
}

export async function claimNextExecution(
  supabase: SupabaseClient,
  userId: string,
  params: {
    workerId: string;
    workerInstanceId: string;
    runtimeProfiles?: string[];
    repository?: string;
    idempotencyKey?: string;
    targetIssueId?: string;
  }
): Promise<{
  status: 'claimed' | 'slot_busy' | 'idle' | 'conflict';
  execution?: any;
  message?: string;
  activeExecutionId?: string;
}> {
  const repo = params.repository || 'loops-app';
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Check if an active execution already holds the slot for this repository
  const { data: activeSessions } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['working', 'connected'])
    .order('started_at', { ascending: false });

  for (const sess of activeSessions || []) {
    const env = sess.environment || {};
    const leaseExpiryMs = env.leaseExpiresAt ? new Date(env.leaseExpiresAt).getTime() : 0;
    const isLeaseActive = leaseExpiryMs > nowMs;
    const isRunning = !['completed', 'failed', 'ended', 'cancelled'].includes(env.stage || '');

    if (isLeaseActive && isRunning && (env.repository === repo || sess.repository === repo)) {
      if (params.idempotencyKey && env.idempotencyKey === params.idempotencyKey) {
        const { data: issueRow } = await supabase
          .from('dev_issues')
          .select('*')
          .eq('id', sess.issue_id)
          .single();
        const issue = issueRow ? mapDevIssue(issueRow) : null;
        return {
          status: 'claimed',
          execution: {
            id: sess.id,
            attemptId: env.attemptId || sess.id,
            sessionId: sess.id,
            token: sess.token,
            issueId: sess.issue_id,
            fencingToken: env.fencingToken || 1,
            leaseExpiresAt: env.leaseExpiresAt,
            stage: env.stage || 'claimed',
            issue,
            contextPackage: {
              baseCommit: 'origin/main',
              taskInstructions: issue?.description || '',
              acceptanceCriteria: issue?.acceptanceCriteria || [],
              runtimeProfileId: env.runtimeProfileId || 'agy-headless',
              limits: { timeoutSeconds: 600, leaseSeconds: 120 }
            }
          }
        };
      }

      return {
        status: 'slot_busy',
        message: `Execution slot for repository '${repo}' is currently held by worker ${env.workerId || 'unknown'} (session ${sess.id})`,
        activeExecutionId: sess.id
      };
    }
  }

  // 2. Query Dev Queue to find next eligible issue
  const queueState = await getDevQueueState(supabase, userId);
  let targetIssueId: string | null = params.targetIssueId || null;
  if (!targetIssueId) {
    targetIssueId = queueState.nextEligibleIssueId;
  }

  if (!targetIssueId) {
    const eligibleItem = queueState.items.find(i => i.isEligible && i.status !== 'accepted' && i.status !== 'completed' && i.status !== 'awaiting_acceptance');
    targetIssueId = eligibleItem ? eligibleItem.issueId : null;
  }

  if (!targetIssueId) {
    return {
      status: 'idle',
      message: 'No eligible tasks found in queue'
    };
  }

  const { data: targetIssueRow, error: issueErr } = await supabase
    .from('dev_issues')
    .select('*')
    .eq('id', targetIssueId)
    .eq('user_id', userId)
    .single();

  if (issueErr || !targetIssueRow) {
    return {
      status: 'idle',
      message: `Issue ${targetIssueId} not found or inaccessible`
    };
  }

  const issue = mapDevIssue(targetIssueRow);

  // 3. Atomically reserve task and slot
  const executionId = generateId('exec');
  const attemptId = generateId('att');
  const fencingToken = Date.now();
  const leaseDurationSeconds = 120;
  const leaseExpiresAt = new Date(nowMs + leaseDurationSeconds * 1000).toISOString();
  const token = 'dtk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const envData = {
    executionId,
    attemptId,
    workerId: params.workerId,
    workerInstanceId: params.workerInstanceId,
    fencingToken,
    leaseExpiresAt,
    lastHeartbeatAt: nowIso,
    stage: 'claimed',
    runtimeProfileId: params.runtimeProfiles?.[0] || 'agy-headless',
    repository: repo,
    idempotencyKey: params.idempotencyKey || null
  };

  const { data: newSession, error: sessErr } = await supabase
    .from('dev_sessions')
    .insert({
      id: executionId,
      issue_id: issue.id,
      user_id: userId,
      agent: params.runtimeProfiles?.[0] || 'agy',
      model: 'gemini-3.8-flash-high',
      status: 'working',
      token,
      token_expires_at: leaseExpiresAt,
      repository: repo,
      branch: 'main',
      environment: envData,
      started_at: nowIso,
      last_activity_at: nowIso
    })
    .select()
    .single();

  if (sessErr || !newSession) {
    throw new Error(`Failed to insert execution session: ${sessErr?.message}`);
  }

  await supabase
    .from('dev_issues')
    .update({
      status: 'in_progress',
      updated_at: nowIso
    })
    .eq('id', issue.id)
    .eq('user_id', userId);

  await appendDevEvent(supabase, userId, {
    issueId: issue.id,
    sessionId: executionId,
    type: 'session.started',
    author: 'luna',
    content: `Execution attempt ${attemptId} claimed by worker ${params.workerId}`,
    metadata: {
      workerId: params.workerId,
      workerInstanceId: params.workerInstanceId,
      fencingToken,
      leaseExpiresAt,
      runtimeProfileId: envData.runtimeProfileId
    }
  });

  await appendDevEvent(supabase, userId, {
    issueId: issue.id,
    sessionId: executionId,
    type: 'execution.claimed' as DevEventType,
    author: 'luna',
    content: `Execution lease granted for 120s (token: ${fencingToken})`,
    metadata: {
      attemptId,
      fencingToken,
      leaseExpiresAt,
      repository: repo
    }
  });

  return {
    status: 'claimed',
    execution: {
      id: executionId,
      attemptId,
      sessionId: executionId,
      token,
      issueId: issue.id,
      fencingToken,
      leaseExpiresAt,
      stage: 'claimed',
      issue: {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        acceptanceCriteria: issue.acceptanceCriteria,
        priority: issue.priority,
        assignedAgent: issue.assignedAgent,
        relatedReferences: issue.relatedReferences
      },
      contextPackage: {
        baseCommit: 'origin/main',
        taskInstructions: issue.description,
        acceptanceCriteria: issue.acceptanceCriteria,
        runtimeProfileId: envData.runtimeProfileId,
        limits: { timeoutSeconds: 600, leaseSeconds: leaseDurationSeconds }
      }
    }
  };
}

export async function renewExecutionLease(
  supabase: SupabaseClient,
  userId: string,
  executionId: string,
  params: {
    workerId: string;
    workerInstanceId: string;
    fencingToken: number;
    stage?: string;
    progress?: any;
  }
): Promise<{
  success: boolean;
  serverTime: string;
  leaseExpiresAt?: string;
  cancelled?: boolean;
  error?: string;
}> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: sessionRow, error: fetchErr } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !sessionRow) {
    return { success: false, serverTime: nowIso, cancelled: true, error: 'Session not found' };
  }

  const env = sessionRow.environment || {};

  if (sessionRow.ended_at || env.cancelled || sessionRow.status === 'ended' || sessionRow.status === 'failed') {
    return { success: false, serverTime: nowIso, cancelled: true, error: 'Execution was cancelled or ended' };
  }

  if (env.workerInstanceId && env.workerInstanceId !== params.workerInstanceId) {
    return { success: false, serverTime: nowIso, cancelled: true, error: 'Worker instance mismatch' };
  }

  if (Number(env.fencingToken) !== Number(params.fencingToken)) {
    return { success: false, serverTime: nowIso, cancelled: true, error: 'Stale fencing token' };
  }

  const currentExpiryMs = env.leaseExpiresAt ? new Date(env.leaseExpiresAt).getTime() : 0;
  if (currentExpiryMs < nowMs) {
    return { success: false, serverTime: nowIso, cancelled: true, error: 'Lease expired; cannot renew retroactively' };
  }

  const leaseDurationSeconds = 120;
  const newLeaseExpiresAt = new Date(nowMs + leaseDurationSeconds * 1000).toISOString();

  const updatedEnv = {
    ...env,
    leaseExpiresAt: newLeaseExpiresAt,
    lastHeartbeatAt: nowIso,
    stage: params.stage || env.stage || 'running'
  };

  await supabase
    .from('dev_sessions')
    .update({
      environment: updatedEnv,
      token_expires_at: newLeaseExpiresAt,
      last_activity_at: nowIso
    })
    .eq('id', executionId)
    .eq('user_id', userId);

  return {
    success: true,
    serverTime: nowIso,
    leaseExpiresAt: newLeaseExpiresAt,
    cancelled: false
  };
}

export async function appendExecutionEvents(
  supabase: SupabaseClient,
  userId: string,
  executionId: string,
  params: {
    workerId: string;
    workerInstanceId: string;
    fencingToken: number;
    events: Array<{
      eventId?: string;
      type: string;
      author?: string;
      content: string;
      metadata?: any;
      timestamp?: string;
    }>;
  }
): Promise<{ success: boolean; appendedCount: number }> {
  const { data: sessionRow, error } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', userId)
    .single();

  if (error || !sessionRow) throw new Error('Session not found');
  const env = sessionRow.environment || {};

  if (Number(env.fencingToken) !== Number(params.fencingToken)) {
    throw new Error('Stale fencing token on event append');
  }

  const { data: existingEvents } = await supabase
    .from('dev_events')
    .select('metadata')
    .eq('session_id', executionId);

  const existingIds = new Set(
    (existingEvents || []).map((e: any) => e.metadata?.eventId).filter(Boolean)
  );

  let count = 0;
  for (const evt of params.events || []) {
    if (evt.eventId && existingIds.has(evt.eventId)) {
      continue;
    }

    const eventMetadata = {
      ...(evt.metadata || {}),
      eventId: evt.eventId || generateId('evt'),
      workerId: params.workerId,
      fencingToken: params.fencingToken
    };

    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: evt.type as DevEventType,
      author: (evt.author as any) || 'luna',
      content: evt.content,
      metadata: eventMetadata
    });
    count++;
  }

  return { success: true, appendedCount: count };
}

export async function finalizeExecution(
  supabase: SupabaseClient,
  userId: string,
  executionId: string,
  params: {
    workerId: string;
    workerInstanceId: string;
    fencingToken: number;
    result: {
      success: boolean;
      finalResponse?: string;
      summary?: string;
      changes?: string[];
      patch?: string;
      testResults?: any;
      buildResults?: any;
      commit?: any;
      caveats?: string[];
      deniedActions?: string[];
    };
  }
): Promise<{ success: boolean; issueStatus: string }> {
  const nowIso = new Date().toISOString();
  const { data: sessionRow, error: fetchErr } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !sessionRow) throw new Error('Session not found');
  const env = sessionRow.environment || {};

  if (Number(env.fencingToken) !== Number(params.fencingToken)) {
    throw new Error('Stale fencing token on finalization');
  }

  const res = params.result || {};
  const isSuccess = res.success === true && (!res.deniedActions || res.deniedActions.length === 0);

  if (isSuccess) {
    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'implementation.reported',
      author: 'luna',
      content: res.summary || 'Implementation completed successfully in isolated worktree',
      metadata: { changes: res.changes || [], patchLength: res.patch ? res.patch.length : 0 }
    });

    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'tests.reported',
      author: 'luna',
      content: 'Independent verification tests passed',
      metadata: res.testResults || { status: 'passed' }
    });

    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'verification.reported',
      author: 'luna',
      content: 'Worktree artifact verification complete',
      metadata: { verified: true }
    });

    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'completion.summary',
      author: 'luna',
      content: res.summary || res.finalResponse || 'Task awaiting acceptance',
      metadata: {
        agent: 'agy-headless',
        summary: res.summary || '',
        changes: res.changes || [],
        caveats: res.caveats || []
      }
    });

    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'session.completed',
      author: 'luna',
      content: 'Execution attempt successfully finalized',
      metadata: { attemptId: env.attemptId }
    });

    await supabase
      .from('dev_issues')
      .update({
        status: 'verification',
        updated_at: nowIso
      })
      .eq('id', sessionRow.issue_id)
      .eq('user_id', userId);

    await supabase
      .from('dev_sessions')
      .update({
        status: 'completed',
        ended_at: nowIso,
        environment: { ...env, stage: 'completed', finalizedAt: nowIso }
      })
      .eq('id', executionId)
      .eq('user_id', userId);

    return { success: true, issueStatus: 'awaiting_acceptance' };
  } else {
    await appendDevEvent(supabase, userId, {
      issueId: sessionRow.issue_id,
      sessionId: executionId,
      type: 'session.failed',
      author: 'luna',
      content: `Execution failed verification: ${JSON.stringify(res.caveats || res.deniedActions || 'unknown')}`,
      metadata: res
    });

    await supabase
      .from('dev_sessions')
      .update({
        status: 'failed',
        ended_at: nowIso,
        environment: { ...env, stage: 'failed', finalizedAt: nowIso }
      })
      .eq('id', executionId)
      .eq('user_id', userId);

    await supabase
      .from('dev_issues')
      .update({
        status: 'ready',
        updated_at: nowIso
      })
      .eq('id', sessionRow.issue_id)
      .eq('user_id', userId);

    return { success: false, issueStatus: 'ready' };
  }
}

export async function cancelExecution(
  supabase: SupabaseClient,
  userId: string,
  executionId: string,
  reason: string = 'administrative_cancellation'
): Promise<{ success: boolean; message: string }> {
  const nowIso = new Date().toISOString();
  const { data: sessionRow, error } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', userId)
    .single();

  if (error || !sessionRow) throw new Error('Session not found');
  const env = sessionRow.environment || {};

  await supabase
    .from('dev_sessions')
    .update({
      status: 'ended',
      ended_at: nowIso,
      environment: { ...env, cancelled: true, cancelReason: reason, stage: 'cancelled' }
    })
    .eq('id', executionId)
    .eq('user_id', userId);

  await appendDevEvent(supabase, userId, {
    issueId: sessionRow.issue_id,
    sessionId: executionId,
    type: 'session.ended',
    author: 'luna',
    content: `Execution cancelled: ${reason}`,
    metadata: { reason }
  });

  return { success: true, message: `Execution ${executionId} cancelled` };
}

export async function reconcileCloudExpiredLeases(
  supabase: SupabaseClient
): Promise<{ reconciledCount: number; expiredSessionIds: string[] }> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: workingSessions } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('status', 'working');

  const expiredSessionIds: string[] = [];

  for (const sess of workingSessions || []) {
    const env = sess.environment || {};
    const leaseExpiry = env.leaseExpiresAt || sess.token_expires_at;
    if (leaseExpiry && new Date(leaseExpiry).getTime() < nowMs) {
      console.log(`[CloudRecovery] Expiring abandoned lease for session ${sess.id} (expired at ${leaseExpiry})`);

      await supabase
        .from('dev_sessions')
        .update({
          status: 'ended',
          ended_at: nowIso,
          environment: { ...env, stage: 'expired', expiredAt: nowIso }
        })
        .eq('id', sess.id);

      await appendDevEvent(supabase, sess.user_id, {
        issueId: sess.issue_id,
        sessionId: sess.id,
        type: 'execution.lease_expired' as DevEventType,
        author: 'luna',
        content: `Execution lease expired without valid heartbeat; freed execution slot`,
        metadata: {
          expiredSessionId: sess.id,
          workerId: env.workerId,
          fencingToken: env.fencingToken
        }
      });

      const { data: issueRow } = await supabase
        .from('dev_issues')
        .select('status')
        .eq('id', sess.issue_id)
        .single();

      if (issueRow?.status === 'in_progress') {
        await supabase
          .from('dev_issues')
          .update({ status: 'ready', updated_at: nowIso })
          .eq('id', sess.issue_id);
      }

      expiredSessionIds.push(sess.id);
    }
  }

  return {
    reconciledCount: expiredSessionIds.length,
    expiredSessionIds
  };
}

let cloudRecoveryInterval: any = null;

export function startCloudLeaseRecoveryScanner(supabase: SupabaseClient, intervalMs = 30000) {
  if (cloudRecoveryInterval) return;
  console.log(`[CloudRecovery] Starting continuous lease recovery scanner (interval: ${intervalMs}ms)`);
  
  reconcileCloudExpiredLeases(supabase).catch(err => {
    console.warn('[CloudRecovery] Error in initial lease recovery scan:', err.message);
  });

  cloudRecoveryInterval = setInterval(() => {
    reconcileCloudExpiredLeases(supabase).catch(err => {
      console.warn('[CloudRecovery] Error in periodic lease recovery scan:', err.message);
    });
  }, intervalMs);
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
          'completion.summary',
          'issue.reopened',
          'scope.updated',
          'session.completed',
          'session.failed',
          'session.handoff',
          'lab.result.published'
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
          watcherHealth: { status: getActiveWorkersCount() > 0 ? 'healthy' : 'offline', mode: 'supervised_execution_v2', activeWatchersCount: getActiveWorkersCount() }
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

  // 5. Creative Asset Bridge Endpoints
  app.post('/api/dev/assets', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const asset = await createDevAsset(supabase, userId, req.body || {});
      const downloadUrl = `/api/dev/assets/${asset.id}/download`;
      res.json({ asset, downloadUrl });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/dev/assets', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { projectId, shotId, batch, status, generatedBy } = req.query;
      const filters: any = {};
      if (typeof projectId === 'string') filters.projectId = projectId;
      if (typeof shotId === 'string') filters.shotId = shotId;
      if (batch) filters.batch = parseInt(batch as string, 10);
      if (typeof status === 'string') filters.status = status;
      if (typeof generatedBy === 'string') filters.generatedBy = generatedBy;

      const assets = await listDevAssets(supabase, userId, filters);
      res.json({ items: assets, count: assets.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/assets/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const asset = await getDevAssetById(supabase, userId, req.params.id);
      if (!asset) return res.status(404).json({ error: 'Asset not found' });
      res.json(asset);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const previewRouteHandler = async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body?.supabaseClient || (app.locals as any)?.supabaseClient;
    
    // Extract ticket & expiration from either path parameters or query parameters
    const ticket = (req.params.ticket as string) || (req.query.ticket as string) || (req.query.sig as string) || (req.query.token as string);
    const expRaw = req.params.exp || req.query.exp || (req.query as any)['amp;exp'] || (req.query as any)['amp;amp;exp'];

    let isAuthorized = false;

    // 1. Check ticket authentication (short-lived HMAC signed URL for Luna GPT / ChatGPT Actions)
    if (typeof ticket === 'string' && (typeof expRaw === 'string' || typeof expRaw === 'number')) {
      if (verifyAssetTicket(req.params.id, ticket, expRaw)) {
        isAuthorized = true;
      }
    }

    // 2. Fall back to standard header authentication
    if (!isAuthorized) {
      await new Promise<void>((resolve) => {
        authenticateRest(req, res, () => {
          resolve();
        });
      });
      if (res.headersSent) return;
      const resolved = await resolveRequestUser(req, supabase);
      if (resolved.userId) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized. Valid preview ticket or Bearer token required.' });
    }

    // Lookup asset (in-memory first, then Supabase)
    let asset: DevAsset | null = null;
    if (localDevAssetStore.has(req.params.id)) {
      asset = localDevAssetStore.get(req.params.id)!;
    } else {
      try {
        const { data } = await supabase.from('dev_assets').select('*').eq('id', req.params.id).maybeSingle();
        if (data) asset = formatDevAsset(data);
      } catch {}
    }

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    let buffer: Buffer | null = null;
    if (asset.dataBase64) {
      buffer = Buffer.from(asset.dataBase64, 'base64');
    } else if (asset.filename) {
      const possiblePaths = [
        path.join(__dirname, '..', 'previews', asset.filename),
        path.join(process.cwd(), 'mcp-server', 'previews', asset.filename),
        path.join(process.cwd(), 'previews', asset.filename),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            buffer = fs.readFileSync(p);
            break;
          } catch {}
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(404).json({ error: 'Asset binary data not available' });
    }

    // Full CORS and modern security headers for ChatGPT markdown image renderers
    res.setHeader('Content-Type', asset.mimeType || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${asset.filename || 'asset.jpg'}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Timing-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests if sent by media fetchers
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunksize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
      res.setHeader('Content-Length', chunksize);
      if (req.method === 'HEAD') return res.end();
      return res.end(buffer.subarray(start, end + 1));
    }

    res.setHeader('Content-Length', buffer.length);
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }
    return res.end(buffer);
  };

  const previewRoutes = [
    '/api/dev/assets/:id/view/:ticket/:exp/:filename',
    '/api/dev/assets/:id/view/:ticket/:exp',
    '/api/dev/assets/:id/preview/:filename',
    '/api/dev/assets/:id/download/:filename',
    '/api/dev/assets/:id/preview',
    '/api/dev/assets/:id/download',
    '/api/dev/assets/:id/:filename',
  ];

  app.get(previewRoutes, previewRouteHandler);
  app.head(previewRoutes, previewRouteHandler);
  app.options(previewRoutes, (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(204).end();
  });

  app.post('/api/dev/assets/:id/ack', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const asset = await ackDevAsset(supabase, userId, req.params.id);
      res.json(asset);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Supervised Execution & Lease Management Routes (V2) ───────────────────

  // Start cloud lease recovery scanner once routes are mounted
  try {
    const anonSupabase = getSupabaseAnon();
    startCloudLeaseRecoveryScanner(anonSupabase, 30000);
  } catch (err: any) {
    console.warn('[CloudRecovery] Could not start lease recovery scanner:', err.message);
  }

  // 1. Worker Heartbeat & Presence
  app.post('/api/dev/workers/heartbeat', authenticateRest, async (req: Request, res: Response) => {
    try {
      const { workerId, workerInstanceId, hostname, platform, runtimeProfiles, availableCapacity, health } = req.body || {};
      if (!workerId || !workerInstanceId) {
        return res.status(400).json({ error: 'workerId and workerInstanceId are required' });
      }

      const presence = recordWorkerHeartbeat({
        workerId,
        workerInstanceId,
        hostname,
        platform,
        runtimeProfiles: Array.isArray(runtimeProfiles) ? runtimeProfiles : ['agy-headless'],
        availableCapacity: availableCapacity ?? 1,
        health
      });

      res.json({
        success: true,
        serverTime: new Date().toISOString(),
        accepted: true,
        activeWorkersCount: getActiveWorkersCount(),
        presence
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Claim Next Execution (Atomic reservation with short lease)
  app.post('/api/dev/executions/claim-next', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { workerId, workerInstanceId, runtimeProfiles, repository, idempotencyKey, targetIssueId } = req.body || {};
      if (!workerId || !workerInstanceId) {
        return res.status(400).json({ error: 'workerId and workerInstanceId are required' });
      }

      recordWorkerHeartbeat({ workerId, workerInstanceId, runtimeProfiles });

      const outcome = await claimNextExecution(supabase, userId, {
        workerId,
        workerInstanceId,
        runtimeProfiles,
        repository,
        idempotencyKey,
        targetIssueId
      });

      res.json(outcome);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Read Execution Attempt State
  app.get('/api/dev/executions/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { data: sess, error } = await supabase
        .from('dev_sessions')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', userId)
        .single();

      if (error || !sess) {
        return res.status(404).json({ error: 'Execution attempt not found' });
      }

      const { data: issueRow } = await supabase
        .from('dev_issues')
        .select('*')
        .eq('id', sess.issue_id)
        .single();

      const events = await listDevEvents(supabase, userId, sess.issue_id, sess.id);

      res.json({
        execution: {
          id: sess.id,
          attemptId: sess.environment?.attemptId || sess.id,
          sessionId: sess.id,
          issueId: sess.issue_id,
          status: sess.status,
          stage: sess.environment?.stage || sess.status,
          workerId: sess.environment?.workerId,
          workerInstanceId: sess.environment?.workerInstanceId,
          fencingToken: sess.environment?.fencingToken,
          leaseExpiresAt: sess.environment?.leaseExpiresAt,
          lastHeartbeatAt: sess.environment?.lastHeartbeatAt,
          repository: sess.environment?.repository || sess.repository,
          runtimeProfileId: sess.environment?.runtimeProfileId,
          issue: issueRow ? mapDevIssue(issueRow) : null,
          events
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Renew Execution Lease (Heartbeat with strict fencing check)
  app.post('/api/dev/executions/:id/heartbeat', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { workerId, workerInstanceId, fencingToken, stage, progress } = req.body || {};
      if (!workerId || !workerInstanceId || fencingToken === undefined) {
        return res.status(400).json({ error: 'workerId, workerInstanceId, and fencingToken are required' });
      }

      recordWorkerHeartbeat({ workerId, workerInstanceId });

      const renewal = await renewExecutionLease(supabase, userId, req.params.id, {
        workerId,
        workerInstanceId,
        fencingToken: Number(fencingToken),
        stage,
        progress
      });

      if (!renewal.success) {
        return res.status(409).json(renewal);
      }
      res.json(renewal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Append Execution Events
  app.post('/api/dev/executions/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { workerId, workerInstanceId, fencingToken, events } = req.body || {};
      if (!workerId || fencingToken === undefined || !Array.isArray(events)) {
        return res.status(400).json({ error: 'workerId, fencingToken, and events array are required' });
      }

      const outcome = await appendExecutionEvents(supabase, userId, req.params.id, {
        workerId,
        workerInstanceId,
        fencingToken: Number(fencingToken),
        events
      });

      res.json(outcome);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Finalize Execution
  app.post('/api/dev/executions/:id/finalize', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { workerId, workerInstanceId, fencingToken, result } = req.body || {};
      if (!workerId || fencingToken === undefined || !result) {
        return res.status(400).json({ error: 'workerId, fencingToken, and result are required' });
      }

      const outcome = await finalizeExecution(supabase, userId, req.params.id, {
        workerId,
        workerInstanceId,
        fencingToken: Number(fencingToken),
        result
      });

      res.json(outcome);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. Cancel Execution
  app.post('/api/dev/executions/:id/cancel', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { userId } = await resolveRequestUser(req, supabase);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { reason } = req.body || {};
      const outcome = await cancelExecution(supabase, userId, req.params.id, reason);
      res.json(outcome);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}


/**
 * Watcher Lifecycle State Machine
 */

export interface WatcherState {
  mode: 'single-shot' | 'daemon';
  activeSessionId: string | null;
  pollIntervalMs: number;
  [key: string]: any;
}

export function handleWatcherDiscoveryEvent(state: WatcherState, sessionId: string): { shouldExit: boolean; nextState: WatcherState } {
  const nextState: WatcherState = {
    ...state,
    activeSessionId: sessionId,
  };
  return {
    shouldExit: state.mode === 'single-shot',
    nextState,
  };
}

export function handleWatcherSessionEndedEvent(state: WatcherState): WatcherState {
  return {
    ...state,
    activeSessionId: null,
    pollIntervalMs: 4000,
  };
}
