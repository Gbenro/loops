// Luna Loops - Audio Storage
// Supabase Storage bucket for voice recordings (private, per-user)
// Falls back to IndexedDB read for migrating legacy local audio

import { supabase } from './supabase.js';

const BUCKET = 'echo-audio';

// ─── Supabase Storage ─────────────────────────────────────────────────────────

function storagePath(userId, echoId, mimeType) {
  const ext = mimeType?.includes('mp4') ? 'mp4'
    : mimeType?.includes('ogg') ? 'ogg'
    : 'webm';
  return `${userId}/${echoId}.${ext}`;
}

// Upload audio blob — returns the storage path, or null on failure
export async function saveAudio(echoId, audioBlob, userId) {
  if (!userId) {
    console.warn('[Audio] Cannot save — user not logged in');
    return null;
  }
  try {
    const path = storagePath(userId, echoId, audioBlob.type);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: true,
      });
    if (error) throw error;
    console.log('[Audio] Uploaded to storage:', path);
    return path;
  } catch (e) {
    console.error('[Audio] Upload failed:', e);
    return null;
  }
}

// Get a short-lived signed URL for playback (1 hour)
export async function getAudioUrl(audioPath) {
  if (!audioPath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(audioPath, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch (e) {
    console.error('[Audio] Could not get signed URL:', e);
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
  } catch (e) {
    console.error('[Audio] Download failed:', e);
    return null;
  }
}

// Delete audio file from storage
export async function deleteAudio(audioPath) {
  if (!audioPath) return false;
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([audioPath]);
    if (error) throw error;
    console.log('[Audio] Deleted from storage:', audioPath);
    return true;
  } catch (e) {
    console.error('[Audio] Delete failed:', e);
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
      const req = db.transaction(IDB_STORE, 'readonly')
        .objectStore(IDB_STORE).getAllKeys();
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
      const req = db.transaction(IDB_STORE, 'readonly')
        .objectStore(IDB_STORE).get(echoId);
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
  } catch { /* ignore */ }
}
