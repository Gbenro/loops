// Luna Loops - Audio Storage
// IndexedDB storage for voice recordings

const DB_NAME = 'cosmic_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_recordings';

let db = null;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[Audio] IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save audio blob for an echo
export async function saveAudio(echoId, audioBlob) {
  try {
    const database = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        id: echoId,
        blob: audioBlob,
        mimeType: audioBlob.type,
        size: audioBlob.size,
        savedAt: new Date().toISOString(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        console.log('[Audio] Saved recording for echo:', echoId);
        resolve(true);
      };

      request.onerror = () => {
        console.error('[Audio] Failed to save:', request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('[Audio] Could not save audio:', e);
    return false;
  }
}

// Get audio blob for an echo
export async function getAudio(echoId) {
  try {
    const database = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(echoId);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('[Audio] Could not get audio:', e);
    return null;
  }
}

// Check if audio exists for an echo
export async function hasAudio(echoId) {
  try {
    const database = await initDB();

    return new Promise((resolve) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(echoId);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  } catch (e) {
    return false;
  }
}

// Delete audio for an echo
export async function deleteAudio(echoId) {
  try {
    const database = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(echoId);

      request.onsuccess = () => {
        console.log('[Audio] Deleted recording for echo:', echoId);
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('[Audio] Could not delete audio:', e);
    return false;
  }
}

// Get storage stats
export async function getStorageStats() {
  try {
    const database = await initDB();

    return new Promise((resolve) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        const totalSize = records.reduce((sum, r) => sum + (r.size || 0), 0);
        resolve({
          count: records.length,
          totalSize,
          formattedSize: formatBytes(totalSize),
        });
      };

      request.onerror = () => {
        resolve({ count: 0, totalSize: 0, formattedSize: '0 B' });
      };
    });
  } catch (e) {
    return { count: 0, totalSize: 0, formattedSize: '0 B' };
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Create a playable URL from stored audio
export function createAudioURL(blob) {
  return URL.createObjectURL(blob);
}

// Revoke audio URL when done
export function revokeAudioURL(url) {
  URL.revokeObjectURL(url);
}
