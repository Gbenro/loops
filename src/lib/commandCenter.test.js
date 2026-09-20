import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  COMMAND_CENTER_CAPABILITIES,
  CREATIVE_VIDEO_1_MANIFEST,
  extractCommandCenterPayload
} from '../../mcp-server/dist/commandCenter.js';
import { LUNA_COMMAND_CENTER_OPENAPI_SPEC } from '../../mcp-server/dist/openapi.js';
import {
  generateAssetTicket,
  verifyAssetTicket,
  buildAssetPreviewUrls,
  VIDEO_1_SEED_MANIFEST,
} from '../../mcp-server/dist/devBridge.js';

describe('Luna Command Center Gateway (6 Operations) Test Suite', () => {
  it('COMMAND_CENTER_CAPABILITIES contains exactly 6 gateway operations below the 30-operation ceiling', () => {
    expect(COMMAND_CENTER_CAPABILITIES.targetGptOperationCount).toBe(6);
    expect(COMMAND_CENTER_CAPABILITIES.baselineMigrationCount).toBe(29);
    const hubKeys = Object.keys(COMMAND_CENTER_CAPABILITIES.hubs);
    expect(hubKeys).toHaveLength(6);
    expect(hubKeys).toEqual(['capabilities', 'core', 'dev', 'lab', 'creative', 'assets']);
  });

  it('Verifies complete 29-to-6 baseline capability mapping without loss', () => {
    const baseline29Operations = [
      // 1-15: Core Personal Field
      'get_lunar_context',
      'search_luna',
      'search_echoes',
      'create_echo',
      'create_conversation_reflection',
      'get_echo',
      'update_echo',
      'attach_reflection',
      'list_loops',
      'create_loop',
      'get_loop',
      'update_loop',
      'list_threads',
      'create_thread',
      'get_thread',
      // 16-20: Chat & Telemetry
      'list_chat_sessions',
      'get_chat_session',
      'search_chat_messages',
      'get_chat_evaluations',
      'get_inference_summary',
      // 21-29: Dev Bridge
      'list_dev_issues',
      'create_dev_issue',
      'get_dev_issue',
      'update_dev_issue_status',
      'get_dev_events',
      'create_dev_session',
      'post_dev_event',
      'claim_dev_session',
      'list_pending_dev_sessions'
    ];

    expect(baseline29Operations).toHaveLength(29);

    // Verify all 29 map into the 6 gateway operations
    const coreSubActions = COMMAND_CENTER_CAPABILITIES.hubs.core.subActions;
    const devSubActions = COMMAND_CENTER_CAPABILITIES.hubs.dev.subActions;

    // Check Core mapping
    expect(coreSubActions).toContain('lunar.get_context');
    expect(coreSubActions).toContain('field.search');
    expect(coreSubActions).toContain('echoes.search');
    expect(coreSubActions).toContain('echoes.create');
    expect(coreSubActions).toContain('reflections.create');
    expect(coreSubActions).toContain('echoes.get');
    expect(coreSubActions).toContain('echoes.update');
    expect(coreSubActions).toContain('reflections.attach');
    expect(coreSubActions).toContain('loops.list');
    expect(coreSubActions).toContain('loops.create');
    expect(coreSubActions).toContain('loops.get');
    expect(coreSubActions).toContain('loops.update');
    expect(coreSubActions).toContain('threads.list');
    expect(coreSubActions).toContain('threads.create');
    expect(coreSubActions).toContain('threads.get');
    expect(coreSubActions).toContain('threads.update');
    expect(coreSubActions).toContain('chat.list_sessions');
    expect(coreSubActions).toContain('chat.get_session');
    expect(coreSubActions).toContain('chat.search_messages');
    expect(coreSubActions).toContain('chat.evaluations');
    expect(coreSubActions).toContain('chat.inference_summary');

    // Check Dev mapping
    expect(devSubActions).toContain('dev.issues.list');
    expect(devSubActions).toContain('dev.issues.create');
    expect(devSubActions).toContain('dev.issues.get');
    expect(devSubActions).toContain('dev.issues.update_status');
    expect(devSubActions).toContain('dev.events.list');
    expect(devSubActions).toContain('dev.sessions.create');
    expect(devSubActions).toContain('dev.events.post');
    expect(devSubActions).toContain('dev.sessions.claim');
    expect(devSubActions).toContain('dev.sessions.pending');
  });

  it('Verifies Creative Studio Video 1 manifest and strict render lock invariant', () => {
    expect(CREATIVE_VIDEO_1_MANIFEST.title).toBe('Creating With the Cycles V1');
    expect(CREATIVE_VIDEO_1_MANIFEST.totalShots).toBe(12);
    expect(CREATIVE_VIDEO_1_MANIFEST.renderLocked).toBe(true);
    expect(CREATIVE_VIDEO_1_MANIFEST.renderLockReason).toContain('strictly locked');
    expect(CREATIVE_VIDEO_1_MANIFEST.shots).toHaveLength(12);
  });

  it('Verifies Client-Specific Least Privilege boundary: Core hub disallows discovery token', () => {
    expect(COMMAND_CENTER_CAPABILITIES.hubs.core.allowDiscoveryToken).toBe(false);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.dev.allowDiscoveryToken).toBe(true);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.creative.allowDiscoveryToken).toBe(true);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.assets.allowDiscoveryToken).toBe(true);
  });

  it('extractCommandCenterPayload seamlessly extracts both nested and flat arguments', () => {
    // 1. Nested payload object
    const nested = {
      action: 'assets.list',
      payload: { status: 'review' }
    };
    expect(extractCommandCenterPayload(nested)).toEqual({ status: 'review' });

    // 2. Flat arguments (fallback if a client passes arguments at root)
    const flat = {
      action: 'assets.list',
      status: 'review'
    };
    expect(extractCommandCenterPayload(flat)).toEqual({ status: 'review' });

    // 3. Merged (nested overrides root, system fields removed)
    const mixed = {
      action: 'dev.events.post',
      supabaseClient: {},
      issueId: 'iss_root',
      payload: {
        issueId: 'iss_nested',
        sessionId: 'sess_123',
        type: 'verification.reported',
        author: 'luna',
        content: 'test',
        metadata: { ok: true }
      }
    };
    const extracted = extractCommandCenterPayload(mixed);
    expect(extracted.issueId).toBe('iss_nested');
    expect(extracted.sessionId).toBe('sess_123');
    expect(extracted.type).toBe('verification.reported');
    expect(extracted.author).toBe('luna');
    expect(extracted.content).toBe('test');
    expect(extracted.metadata).toEqual({ ok: true });
    expect(extracted.action).toBeUndefined();
    expect(extracted.payload).toBeUndefined();
    expect(extracted.supabaseClient).toBeUndefined();
  });

  it('Verifies OpenAPI schema exposes action and explicit payload properties for all 5 POST hubs', () => {
    const schemas = LUNA_COMMAND_CENTER_OPENAPI_SPEC.components.schemas;

    // DevRequest verification
    const devPayloadProps = schemas.DevRequest.properties.payload.properties;
    expect(devPayloadProps).toBeDefined();
    expect(devPayloadProps.issueId).toBeDefined();
    expect(devPayloadProps.sessionId).toBeDefined();
    expect(devPayloadProps.type).toBeDefined();
    expect(devPayloadProps.author).toBeDefined();
    expect(devPayloadProps.content).toBeDefined();
    expect(devPayloadProps.metadata).toBeDefined();

    // AssetRequest verification
    const assetPayloadProps = schemas.AssetRequest.properties.payload.properties;
    expect(assetPayloadProps).toBeDefined();
    expect(assetPayloadProps.status).toBeDefined();
    expect(assetPayloadProps.id).toBeDefined();
    expect(assetPayloadProps.filename).toBeDefined();
    expect(assetPayloadProps.mimeType).toBeDefined();
    expect(assetPayloadProps.dataBase64).toBeDefined();

    // CoreRequest verification
    const corePayloadProps = schemas.CoreRequest.properties.payload.properties;
    expect(corePayloadProps).toBeDefined();
    expect(corePayloadProps.query).toBeDefined();
    expect(corePayloadProps.limit).toBeDefined();
    expect(corePayloadProps.id).toBeDefined();
    expect(corePayloadProps.text).toBeDefined();

    // LabRequest verification
    const labPayloadProps = schemas.LabRequest.properties.payload.properties;
    expect(labPayloadProps).toBeDefined();
    expect(labPayloadProps.query).toBeDefined();
    expect(labPayloadProps.tokenBudget).toBeDefined();

    // CreativeRequest verification
    const creativePayloadProps = schemas.CreativeRequest.properties.payload.properties;
    expect(creativePayloadProps).toBeDefined();
    expect(creativePayloadProps.shotId).toBeDefined();

    // Zero secret exposure
    const specStr = JSON.stringify(LUNA_COMMAND_CENTER_OPENAPI_SPEC);
    expect(specStr).not.toContain('dsc_');
    expect(specStr).not.toContain('dtk_');
    expect(specStr).not.toContain('Bearer dsc_');
  });

  it('Verifies HMAC asset preview tickets grant secure, unauthenticated, time-bounded access', () => {
    const assetId = 'ast_v1_shot_08_shot_08_waxing_jpg';
    const nowSec = Math.floor(Date.now() / 1000);
    const validExp = nowSec + 86400; // 24 hours
    const expiredExp = nowSec - 10; // expired 10s ago

    const validTicket = generateAssetTicket(assetId, validExp);
    expect(validTicket).toBeDefined();
    expect(typeof validTicket).toBe('string');
    expect(validTicket.length).toBe(64); // SHA-256 hex length

    // Valid ticket verification
    expect(verifyAssetTicket(assetId, validTicket, validExp)).toBe(true);

    // Expired ticket verification fails
    const expiredTicket = generateAssetTicket(assetId, expiredExp);
    expect(verifyAssetTicket(assetId, expiredTicket, expiredExp)).toBe(false);

    // Tampered ticket verification fails
    const tamperedTicket = validTicket.slice(0, -2) + 'aa';
    expect(verifyAssetTicket(assetId, tamperedTicket, validExp)).toBe(false);

    // Mismatched assetId fails
    expect(verifyAssetTicket('different_asset_id', validTicket, validExp)).toBe(false);
  });

  it('Verifies buildAssetPreviewUrls generates absolute HTTPS ticketed URLs', () => {
    const mockReq = {
      protocol: 'http',
      get: (h) => (h === 'host' ? 'loops-production-e1d5.up.railway.app' : undefined),
      headers: {
        'x-forwarded-proto': 'https',
      },
    };

    const assetId = 'ast_test_123';
    const urls = buildAssetPreviewUrls(mockReq, assetId);
    expect(urls.previewUrl).toContain('https://loops-production-e1d5.up.railway.app/api/dev/assets/ast_test_123/preview?ticket=');
    expect(urls.previewUrl).toContain('&exp=');
    expect(urls.downloadUrl).toContain('https://loops-production-e1d5.up.railway.app/api/dev/assets/ast_test_123/download?ticket=');
  });

  it('Verifies VIDEO_1_SEED_MANIFEST contains all 21 production shots and variations', () => {
    expect(VIDEO_1_SEED_MANIFEST).toHaveLength(21);
    const filenames = VIDEO_1_SEED_MANIFEST.map(m => m.filename);
    expect(filenames).toContain('shot_08_waxing.jpg');
    expect(filenames).toContain('shot_08_waning.jpg');
    expect(filenames).toContain('shot_01_seedling_source.jpg');
    expect(filenames).toContain('shot_12_release.jpg');
    expect(filenames).toContain('shot_12_rest.jpg');
  });
});
