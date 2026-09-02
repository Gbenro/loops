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
export async function saveAudio(echoId, audioBlob, userId) {
  if (!userId) {
    return null;
  }
  if (audioBlob.size > MAX_AUDIO_SIZE) {
    return 'TOO_LARGE';
  }
  try {
    const path = storagePath(userId, echoId, audioBlob.type);
    const { error } = await supabase.storage.from(BUCKET).upload(path, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      upsert: true,
    });
    if (error) throw error;
    return path;
  } catch (_e) {
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
    const req = indexedDB.open(DRAFT_IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
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
        blob: audioBlob,
        size: audioBlob.size,
        type: audioBlob.type,
        createdAt: new Date().toISOString(),
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
      const tx = db.transaction(DRAFT_STORE, 'readonly');
      const req = tx.objectStore(DRAFT_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
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

