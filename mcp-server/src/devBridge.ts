import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

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

const generateId = (prefix = 'dev') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

// ─── Schema Mappers ─────────────────────────────────────────────────────────

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
        hash: evt.metadata?.hash || evt.metadata?.commit,
        branch: evt.metadata?.branch,
        message: evt.content || evt.metadata?.message,
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

// ─── Service Methods ─────────────────────────────────────────────────────────

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
): Promise<{ issue: DevIssue; latestSession: DevSession | null; evidence: DevEvidenceSummary }> {
  const { data: issueRow, error: issueErr } = await supabase
    .from('dev_issues')
    .select('*')
    .eq('id', issueId)
    .eq('user_id', userId)
    .single();

  if (issueErr || !issueRow) throw new Error(issueErr?.message || `Dev Issue not found: ${issueId}`);
  const issue = mapDevIssue(issueRow);

  // Fetch latest session for this issue
  const { data: sessionRows } = await supabase
    .from('dev_sessions')
    .select('*')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1);

  const latestSession = sessionRows && sessionRows.length > 0 ? mapDevSession(sessionRows[0]) : null;

  // Fetch events for factual evidence summary
  const { data: eventRows } = await supabase
    .from('dev_events')
    .select('*')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const events = (eventRows || []).map(mapDevEvent);
  const evidence = computeFactualEvidence(events);

  return { issue, latestSession, evidence };
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('dev_issues')
    .insert(insertData)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create Dev Issue');
  return mapDevIssue(data);
}

/**
 * Non-linear status updates: allows looping backward (e.g. verification -> in_progress)
 * and logs an auditable status change event.
 */
export async function updateDevIssueStatus(
  supabase: SupabaseClient,
  userId: string,
  issueId: string,
  status: DevIssue['status'],
  notes?: string,
  sessionId?: string
): Promise<DevIssue> {
  const updatePayload: any = {
    status,
    updated_at: new Date().toISOString()
  };

  if (status === 'completed') {
    updatePayload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('dev_issues')
    .update(updatePayload)
    .eq('id', issueId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || `Failed to update status for issue ${issueId}`);
  const issue = mapDevIssue(data);

  // If a session ID is supplied or active, record transition event
  if (sessionId) {
    await appendDevEvent(supabase, userId, {
      issueId,
      sessionId,
      type: status === 'blocked' ? 'developer.blocked' : 'requirement.changed',
      author: 'luna',
      content: notes || `Issue status changed to ${status}`,
      metadata: { newStatus: status, previousStatus: data.status }
    });
  }

  return issue;
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

  const insertData = {
    id,
    issue_id: params.issueId,
    user_id: userId,
    agent: params.agent || 'gemini',
    model: params.model || null,
    status: 'connected',
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
): Promise<{ success: boolean; lastActivityAt: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dev_sessions')
    .update({ last_activity_at: now })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true, lastActivityAt: now };
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

  // Update session last_activity_at
  await supabase
    .from('dev_sessions')
    .update({ last_activity_at: now })
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
    decision: 'approved' | 'rejected';
    answer: string;
  }
): Promise<DevEvent> {
  const eventType: DevEventType = params.decision === 'approved' ? 'decision.approved' : 'decision.rejected';
  return appendDevEvent(supabase, userId, {
    issueId: params.issueId,
    sessionId: params.sessionId,
    type: eventType,
    author: 'luna',
    content: params.answer,
    metadata: {
      questionEventId: params.questionEventId || null,
      decision: params.decision
    }
  });
}

// ─── REST Route Registrations ────────────────────────────────────────────────

export function registerDevBridgeRoutes(app: Express, authenticateRest: any) {
  // 1. Issues CRUD & Filtering
  app.get('/api/dev/issues', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { status, priority, limit } = req.query;
      const issues = await listDevIssues(supabase, user.id, {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { title, description, acceptanceCriteria, priority, assignedAgent, relatedReferences } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }

      const issue = await createDevIssue(supabase, user.id, {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const details = await getDevIssue(supabase, user.id, req.params.id);
      res.json(details);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.patch('/api/dev/issues/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { status, notes, sessionId } = req.body;
      if (!status) return res.status(400).json({ error: 'status is required' });

      const updated = await updateDevIssueStatus(supabase, user.id, req.params.id, status, notes, sessionId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Dev Sessions Management
  app.post('/api/dev/sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { issueId, agent, model, repository, branch, environment } = req.body;
      if (!issueId) return res.status(400).json({ error: 'issueId is required' });

      const session = await createDevSession(supabase, user.id, {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const session = await getDevSession(supabase, user.id, req.params.id);
      res.json(session);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/:id/heartbeat', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const result = await heartbeatDevSession(supabase, user.id, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/sessions/:id/end', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { summary } = req.body;
      const session = await endDevSession(supabase, user.id, req.params.id, summary);
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Event Stream & Question/Evidence Exchange
  app.post('/api/dev/sessions/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { issueId, type, author, content, metadata } = req.body;
      if (!issueId || !type || !content) {
        return res.status(400).json({ error: 'issueId, type, and content are required' });
      }

      const event = await appendDevEvent(supabase, user.id, {
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

  app.get('/api/dev/sessions/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { issueId } = req.query;
      if (!issueId) return res.status(400).json({ error: 'issueId is required' });

      const events = await listDevEvents(supabase, user.id, issueId as string, req.params.id);
      res.json({ items: events, count: events.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/issues/:id/events', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const events = await listDevEvents(supabase, user.id, req.params.id);
      const evidence = computeFactualEvidence(events);

      res.json({ items: events, count: events.length, evidence });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
