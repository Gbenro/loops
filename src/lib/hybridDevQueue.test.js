import { describe, it, expect } from 'vitest';

describe('V1 Hybrid Development Queue, Watcher Recovery, and Telemetry Orchestration', () => {
  const PRIORITY_WEIGHTS = {
    critical: 400,
    high: 300,
    medium: 200,
    low: 100
  };

  function computeQueueState(issues, sessions, events) {
    const completedIds = new Set(issues.filter(i => i.status === 'completed').map(i => i.id));

    const items = issues.map((issue, index) => {
      const issueEvents = events.filter(e => e.issue_id === issue.id);
      const issueSessions = sessions.filter(s => s.issue_id === issue.id);
      const latestSession = issueSessions[0] || null;

      const hasBlocker = issueEvents.some(e => e.type === 'developer.blocked') &&
        !issueEvents.some(e => e.type === 'decision.approved');
      const hasFailedVerification = issueEvents.some(e => e.type === 'tests.reported' && e.metadata?.status === 'failed');

      const reportedEvidence = new Set(
        issueEvents
          .filter(e => e.type.endsWith('.reported'))
          .map(e => e.type.replace('.reported', ''))
      );
      const evidenceCount = reportedEvidence.size;

      let status = 'queued';
      const timestamps = { queuedAt: issue.created_at };

      if (issue.status === 'completed') {
        status = 'accepted';
        timestamps.acceptedAt = issue.completed_at || issue.updated_at;
      } else if (hasBlocker) {
        status = 'blocked';
      } else if (hasFailedVerification) {
        status = 'failed_verification';
      } else if (evidenceCount === 6 || issue.status === 'verification') {
        status = 'awaiting_acceptance';
        timestamps.awaitingAcceptanceAt = issueEvents.find(e => e.type === 'verification.reported')?.created_at || issue.updated_at;
      } else if (evidenceCount > 0) {
        status = 'evidence_received';
        timestamps.evidenceReceivedAt = issueEvents.find(e => e.type?.endsWith('.reported'))?.created_at;
      } else if (latestSession && (latestSession.status === 'working' || issue.status === 'in_progress' || issueEvents.some(e => e.type === 'implementation.started'))) {
        status = 'working';
        timestamps.workingAt = issueEvents.find(e => e.type === 'implementation.started')?.created_at || latestSession.last_activity_at;
      } else if (latestSession && latestSession.status === 'connected') {
        status = 'claimed';
        timestamps.claimedAt = latestSession.last_activity_at;
        timestamps.agentAwakeAt = latestSession.last_activity_at;
      } else if (latestSession && latestSession.status === 'pending') {
        status = 'discovered';
        timestamps.discoveredAt = latestSession.started_at;
      }

      const dependencies = Array.isArray(issue.related_references) ? issue.related_references : [];
      const depsSatisfied = dependencies.every(depId => completedIds.has(depId));
      const isEligible = depsSatisfied && (status === 'queued' || status === 'discovered' || status === 'claimed');
      const priority = issue.priority || 'medium';
      const priorityWeight = PRIORITY_WEIGHTS[priority] || 200;

      return {
        id: `qi_${issue.id}`,
        issueId: issue.id,
        title: issue.title,
        priority,
        priorityWeight,
        status,
        order: index,
        dependencies,
        isEligible,
        evidenceCount,
        timestamps
      };
    });

    items.sort((a, b) => {
      if (a.priorityWeight !== b.priorityWeight) {
        return b.priorityWeight - a.priorityWeight;
      }
      return a.order - b.order;
    });

    const nextEligible = items.find(i => i.isEligible && i.status !== 'accepted' && i.status !== 'completed');

    return {
      items,
      nextEligibleIssueId: nextEligible ? nextEligible.issueId : null
    };
  }

  it('Scenario 1: Normal sequential queue advancement with acceptance gate', () => {
    let issues = [
      { id: 'iss_1', title: 'Task 1', status: 'ready', priority: 'high', created_at: '2026-09-03T10:00:00Z', related_references: [] },
      { id: 'iss_2', title: 'Task 2', status: 'ready', priority: 'high', created_at: '2026-09-03T10:05:00Z', related_references: [] }
    ];
    let sessions = [
      { id: 'sess_1', issue_id: 'iss_1', status: 'connected', started_at: '2026-09-03T10:01:00Z', last_activity_at: '2026-09-03T10:02:00Z' }
    ];
    let events = [
      { id: 'e1', issue_id: 'iss_1', type: 'implementation.started', created_at: '2026-09-03T10:02:00Z' }
    ];

    // While working on Task 1, Task 1 is working and Task 2 is eligible
    let state = computeQueueState(issues, sessions, events);
    expect(state.items[0].status).toBe('working');
    expect(state.items[1].isEligible).toBe(true);

    // Provide full evidence for Task 1
    ['implementation', 'tests', 'build', 'commit', 'deployment', 'verification'].forEach((dim, idx) => {
      events.push({
        id: `e_${dim}`,
        issue_id: 'iss_1',
        type: `${dim}.reported`,
        created_at: `2026-09-03T10:1${idx}:00Z`,
        metadata: { status: 'passed' }
      });
    });

    state = computeQueueState(issues, sessions, events);
    expect(state.items[0].status).toBe('awaiting_acceptance');

    // Advance queue (accept Task 1)
    issues[0].status = 'completed';
    issues[0].completed_at = '2026-09-03T10:20:00Z';

    state = computeQueueState(issues, sessions, events);
    expect(state.items[0].status).toBe('accepted');
    expect(state.nextEligibleIssueId).toBe('iss_2');
  });

  it('Scenario 2: Watcher misses push event but durable queue reconciles on wake/reconnect', () => {
    // Durable queue holds unhandled ready issue
    const issues = [
      { id: 'iss_missed', title: 'Missed Event Task', status: 'ready', priority: 'critical', created_at: '2026-09-03T11:00:00Z', related_references: [] }
    ];
    const sessions = []; // No session minted yet because watcher missed notification
    const events = [];

    // Worker wakes up and asks queue for state
    const state = computeQueueState(issues, sessions, events);
    expect(state.items[0].status).toBe('queued');
    expect(state.items[0].isEligible).toBe(true);
    expect(state.nextEligibleIssueId).toBe('iss_missed');
  });

  it('Scenario 3: Queue empty then watcher discovers newly arrived work', () => {
    let issues = [];
    let state = computeQueueState(issues, [], []);
    expect(state.items).toHaveLength(0);
    expect(state.nextEligibleIssueId).toBeNull();

    // New issue arrives
    issues.push({ id: 'iss_new', title: 'New Arrival', status: 'ready', priority: 'medium', created_at: '2026-09-03T12:00:00Z', related_references: [] });
    state = computeQueueState(issues, [], []);
    expect(state.items).toHaveLength(1);
    expect(state.nextEligibleIssueId).toBe('iss_new');
  });

  it('Scenario 4: New item added or reprioritized while approval is pending without losing state', () => {
    const issues = [
      { id: 'iss_approval', title: 'Awaiting Acceptance', status: 'ready', priority: 'medium', created_at: '2026-09-03T09:00:00Z', related_references: [] },
      { id: 'iss_urgent', title: 'Urgent Production Fix', status: 'ready', priority: 'critical', created_at: '2026-09-03T09:30:00Z', related_references: [] }
    ];
    const events = ['implementation', 'tests', 'build', 'commit', 'deployment', 'verification'].map(dim => ({
      id: `e_${dim}`,
      issue_id: 'iss_approval',
      type: `${dim}.reported`,
      created_at: '2026-09-03T09:15:00Z',
      metadata: { status: 'passed' }
    }));

    const state = computeQueueState(issues, [], events);
    // Critical issue is sorted ahead of medium issue
    expect(state.items[0].issueId).toBe('iss_urgent');
    expect(state.items[1].issueId).toBe('iss_approval');
    expect(state.items[1].status).toBe('awaiting_acceptance');
    expect(state.nextEligibleIssueId).toBe('iss_urgent');
  });

  it('Scenario 5: Failed verification halts advancement; blocked item routes without silently advancing', () => {
    const issues = [
      { id: 'iss_failed', title: 'Flaky Build Issue', status: 'ready', priority: 'high', created_at: '2026-09-03T10:00:00Z', related_references: [] },
      { id: 'iss_dependent', title: 'Dependent Next Step', status: 'ready', priority: 'high', created_at: '2026-09-03T10:05:00Z', related_references: ['iss_failed'] }
    ];
    const events = [
      { id: 'e_fail', issue_id: 'iss_failed', type: 'tests.reported', metadata: { status: 'failed' }, created_at: '2026-09-03T10:10:00Z' }
    ];

    const state = computeQueueState(issues, [], events);
    expect(state.items[0].status).toBe('failed_verification');
    expect(state.items[1].isEligible).toBe(false); // Dependent cannot run because prerequisite failed
    expect(state.nextEligibleIssueId).toBeNull();
  });

  it('Scenario 6: Priority promotion and dependency eligibility prevent premature dependent execution', () => {
    const issues = [
      { id: 'iss_base', title: 'Core Schema Migration', status: 'ready', priority: 'high', created_at: '2026-09-03T08:00:00Z', related_references: [] },
      { id: 'iss_consumer', title: 'UI Consumer of Migration', status: 'ready', priority: 'high', created_at: '2026-09-03T08:05:00Z', related_references: ['iss_base'] },
      { id: 'iss_independent', title: 'Independent Doc Fix', status: 'ready', priority: 'low', created_at: '2026-09-03T08:10:00Z', related_references: [] }
    ];

    let state = computeQueueState(issues, [], []);
    // iss_consumer is not eligible until iss_base is completed
    const consumerItem = state.items.find(i => i.issueId === 'iss_consumer');
    expect(consumerItem.isEligible).toBe(false);

    // iss_base is next eligible
    expect(state.nextEligibleIssueId).toBe('iss_base');

    // Complete iss_base
    issues[0].status = 'completed';
    state = computeQueueState(issues, [], []);

    // Now iss_consumer becomes eligible
    const updatedConsumer = state.items.find(i => i.issueId === 'iss_consumer');
    expect(updatedConsumer.isEligible).toBe(true);
    expect(state.nextEligibleIssueId).toBe('iss_consumer');
  });
});
