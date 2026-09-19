// Luna Loops - Audio Storage
// Supabase Storage bucket for voice recordings (private, per-user)
// Falls back to IndexedDB read for migrating legacy local audio

import { supabase } from './supabase.js';

const BUCKET = 'echo-audio';
const MAX_AUDIO_SIZE = 200 * 1024 * 1024; // 200 MB

// ─── Supabase Storage ─────────────────────────────────────────────────────────

function storagePath(userId, echoId, mimeType) {
  const ext = mimeType?.includes('mp4') || mimeType?.includes('m4a') || mimeType?.includes('aac') ? 'mp4' :
              mimeType?.includes('ogg') || mimeType?.includes('opus') ? 'ogg' :
              mimeType?.includes('wav') ? 'wav' :
              mimeType?.includes('flac') ? 'flac' : 'webm';
  return `${userId}/${echoId}.${ext}`;
}

// ─── Audio Blob Normalization & Diagnostics ───────────────────────────────────

export function normalizeAudioBlob(rawBlob, fallbackType = 'audio/webm') {
  if (!rawBlob) return null;
  if (typeof Blob !== 'undefined' && rawBlob instanceof Blob) {
    const mimeType = (rawBlob.type && rawBlob.type !== 'application/octet-stream') ? rawBlob.type : fallbackType;
    if (rawBlob.type === mimeType) return rawBlob;
    return new Blob([rawBlob], { type: mimeType });
  }
  if (rawBlob instanceof ArrayBuffer) {
    return new Blob([rawBlob], { type: fallbackType });
  }
  if (ArrayBuffer.isView(rawBlob)) {
    return new Blob([rawBlob.buffer], { type: fallbackType });
  }
  if (typeof rawBlob === 'object') {
    if (rawBlob.buffer instanceof ArrayBuffer) {
      return new Blob([rawBlob.buffer], { type: rawBlob.type || fallbackType });
    }
    if (rawBlob.data instanceof ArrayBuffer) {
      return new Blob([rawBlob.data], { type: rawBlob.type || fallbackType });
    }
    if (rawBlob.blob && typeof Blob !== 'undefined' && rawBlob.blob instanceof Blob) {
      return rawBlob.blob;
    }
  }
  return null;
}

export function classifyAudioUploadError(err, audioBlob, userId) {
  if (!userId) {
    return {
      category: 'AUTH_REQUIRED',
      userMessage: 'You are signed out or your session has expired. Please sign in to sync audio recordings.',
      retryable: true,
      originalError: err
    };
  }
  if (!audioBlob || (typeof audioBlob.size === 'number' && audioBlob.size === 0)) {
    return {
      category: 'PAYLOAD_EMPTY',
      userMessage: 'The audio recording was empty or corrupt. Your draft text remains safely saved on this device.',
      retryable: false,
      originalError: err
    };
  }
  if (audioBlob.size > MAX_AUDIO_SIZE) {
    return {
      category: 'PAYLOAD_TOO_LARGE',
      userMessage: `The audio recording exceeds the 200MB size limit (${(audioBlob.size / 1024 / 1024).toFixed(0)}MB). Your transcript has been saved.`,
      retryable: false,
      originalError: err
    };
  }

  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.statusCode || (err?.error && err.error.status);

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('jwt') ||
    msg.includes('row-level security') ||
    msg.includes('policy') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('permission denied')
  ) {
    return {
      category: 'STORAGE_POLICY_OR_AUTH',
      userMessage: 'Could not upload audio due to a storage authorization or policy restriction. Your voice recording remains saved safely on this device.',
      retryable: true,
      originalError: err
    };
  }

  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    return {
      category: 'NETWORK_TIMEOUT',
      userMessage: 'Audio upload timed out after 30s due to a slow or unstable network. Your voice recording remains saved safely on this device. You can retry save at any time.',
      retryable: true,
      originalError: err
    };
  }

  if (
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('connection error') ||
    msg.includes('econnrefused')
  ) {
    return {
      category: 'NETWORK_OFFLINE',
      userMessage: 'Could not connect to cloud storage (network offline or connection error). Your voice recording remains saved safely on this device. You can retry save at any time.',
      retryable: true,
      originalError: err
    };
  }

  if (status >= 500 || msg.includes('server error') || msg.includes('internal error')) {
    return {
      category: 'SERVER_ERROR',
      userMessage: 'Cloud storage service is temporarily unavailable (server error). Your voice recording remains saved safely on this device. You can retry save at any time.',
      retryable: true,
      originalError: err
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    userMessage: `Audio upload failed (${err?.message || 'unknown error'}). Your voice recording and text draft remain saved safely on this device.`,
    retryable: true,
    originalError: err
  };
}

// Upload audio blob — returns the storage path, 'TOO_LARGE' if over limit, or null on failure (or structured result if options.detailed)
export async function saveAudio(echoId, audioBlob, userId, options = {}) {
  const normalizedBlob = normalizeAudioBlob(audioBlob);
  if (!normalizedBlob) {
    const errorInfo = classifyAudioUploadError(new Error('Invalid or missing audio payload'), audioBlob, userId);
    if (options.detailed) return { success: false, ...errorInfo };
    return null;
  }
  if (normalizedBlob.size > MAX_AUDIO_SIZE) {
    const errorInfo = classifyAudioUploadError(new Error('Audio too large'), normalizedBlob, userId);
    if (options.detailed) return { success: false, ...errorInfo };
    return 'TOO_LARGE';
  }
  if (!userId) {
    const errorInfo = classifyAudioUploadError(new Error('Unauthorized'), normalizedBlob, userId);
    if (options.detailed) return { success: false, ...errorInfo };
    return null;
  }

  const timeoutMs = options.timeoutMs || 30000;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Audio upload timed out after 30s')), timeoutMs);
  });

  try {
    const path = storagePath(userId, echoId, normalizedBlob.type);
    const uploadPromise = supabase.storage.from(BUCKET).upload(path, normalizedBlob, {
      contentType: normalizedBlob.type || 'audio/webm',
      upsert: true,
    });

    const result = await Promise.race([uploadPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    if (result.error) throw result.error;
    if (options.detailed) {
      return { success: true, path, category: 'SUCCESS' };
    }
    return path;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    const errorInfo = classifyAudioUploadError(err, normalizedBlob, userId);
    console.warn('[AudioStorage] saveAudio failed or timed out:', errorInfo.category, err?.message || err);
    if (options.detailed) {
      return { success: false, ...errorInfo };
    }
    return null;
  }
}

// Get a short-lived signed URL for playback (1 hour)
export async function getAudioUrl(audioPath) {
  if (!audioPath) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(audioPath, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch (_e) {
    return null;
  }
}

// Download blob (for the download button) — uses signed URL
export async function getAudio(audioPath) {
  if (!audioPath) return null;
  try {
    const url = await getAudioUrl(audioPath);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return await res.blob();
  } catch (_e) {
    return null;
  }
}

// Delete audio file from storage
export async function deleteAudio(audioPath) {
  if (!audioPath) return false;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([audioPath]);
    if (error) throw error;
    return true;
  } catch (_e) {
    return false;
  }
}

// ─── Legacy IndexedDB (read-only, for migration) ──────────────────────────────

const IDB_NAME = 'cosmic_audio_db';
const IDB_STORE = 'audio_recordings';

async function openLegacyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => resolve(null); // empty DB, nothing to migrate
  });
}

// Read all legacy IndexedDB entries for migration
export async function getLegacyAudioIds() {
  try {
    const db = await openLegacyDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getLegacyAudioBlob(echoId) {
  try {
    const db = await openLegacyDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(echoId);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteLegacyAudio(echoId) {
  try {
    const db = await openLegacyDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(echoId);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    /* ignore */
  }
}

// ─── Durable Draft Audio Storage (IndexedDB) ──────────────────────────────────
// Preserves raw audio blobs across failed transcriptions, reloads, and offline edits

const DRAFT_IDB_NAME = 'luna_draft_audio_db';
const DRAFT_STORE = 'draft_recordings';

async function openDraftDB() {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    try {
      const req = indexedDB.open(DRAFT_IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve(req.result);
      };
      req.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export async function saveDraftAudio(draftId, audioBlob, metadata = {}) {
  try {
    const db = await openDraftDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_STORE, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE);
      const record = {
        id: draftId,
        echoId: metadata.echoId || draftId,
        userId: metadata.userId || null,
        text: metadata.text || '',
        blob: audioBlob,
        size: audioBlob ? audioBlob.size : 0,
        type: audioBlob ? audioBlob.type : '',
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: metadata.status || 'draft', // 'draft' | 'transcribing' | 'saving' | 'synced' | 'failed'
        lunarContext: metadata.lunarContext || null,
        audioPath: metadata.audioPath || null,
        lastError: metadata.lastError || null,
        retryCount: metadata.retryCount || 0,
        metadata
      };
      store.put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function updateDraftAudio(draftId, updates = {}) {
  try {
    const db = await openDraftDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_STORE, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE);
      const getReq = store.get(draftId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          resolve(null);
          return;
        }
        const updated = {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            ...(updates.metadata || {})
          }
        };
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
        tx.onerror = () => resolve(null);
      };
      getReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getDraftAudio(draftId) {
  try {
    const db = await openDraftDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_STORE, 'readonly');
      const req = tx.objectStore(DRAFT_STORE).get(draftId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllDraftAudio() {
  try {
    const db = await openDraftDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), 2000);
      try {
        const tx = db.transaction(DRAFT_STORE, 'readonly');
        const req = tx.objectStore(DRAFT_STORE).getAll();
        req.onsuccess = () => {
          clearTimeout(timer);
          const res = req.result;
          const sanitized = Array.isArray(res)
            ? res.filter((d) => d && typeof d === 'object').map((d) => ({
                ...d,
                blob: normalizeAudioBlob(d.blob || d.audioBlob),
              }))
            : [];
          resolve(sanitized);
        };
        req.onerror = () => {
          clearTimeout(timer);
          resolve([]);
        };
      } catch {
        clearTimeout(timer);
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

export async function deleteDraftAudio(draftId) {
  try {
    const db = await openDraftDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_STORE, 'readwrite');
      tx.objectStore(DRAFT_STORE).delete(draftId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

