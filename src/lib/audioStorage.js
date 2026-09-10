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

// Upload audio blob — returns the storage path, 'TOO_LARGE' if over limit, or null on failure
export async function saveAudio(echoId, audioBlob, userId, options = {}) {
  if (!userId) {
    return null;
  }
  if (audioBlob.size > MAX_AUDIO_SIZE) {
    return 'TOO_LARGE';
  }
  const timeoutMs = options.timeoutMs || 30000;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Audio upload timed out after 30s')), timeoutMs);
  });

  try {
    const path = storagePath(userId, echoId, audioBlob.type);
    const uploadPromise = supabase.storage.from(BUCKET).upload(path, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      upsert: true,
    });

    const result = await Promise.race([uploadPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    if (result.error) throw result.error;
    return path;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('[AudioStorage] saveAudio failed or timed out:', err?.message || err);
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
          resolve(Array.isArray(res) ? res.filter((d) => d && typeof d === 'object') : []);
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

