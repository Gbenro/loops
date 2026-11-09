// Luna Classic - Audio Format Detection & Safe Download Utilities
// Inspects binary magic bytes, generates clean descriptive filenames,
// and ensures Android Chrome / mobile download reliability without .bin degradation.

/**
 * Detects the verified audio container format and MIME type from raw bytes (ArrayBuffer or Uint8Array).
 * Inspects standard container magic bytes without relying on browser assumptions or file path extensions.
 *
 * Supported formats:
 * - WebM / Matroska (EBML 0x1A 0x45 0xDF 0xA3) -> .webm (audio/webm)
 * - M4A / MP4 ('ftyp' box at offset 4) -> .m4a (audio/mp4)
 * - Ogg ('OggS') -> .ogg (audio/ogg)
 * - MP3 ('ID3' header or MPEG sync frame 0xFF 0xFB/F3/F2) -> .mp3 (audio/mpeg)
 * - WAV ('RIFF' + 'WAVE') -> .wav (audio/wav)
 * - FLAC ('fLaC') -> .flac (audio/flac)
 * - AAC (ADTS sync 0xFF 0xF1/F9) -> .m4a (audio/aac)
 *
 * @param {ArrayBuffer|Uint8Array|ArrayLike<number>} buffer
 * @param {string} [fallbackMimeType] Optional MIME type from metadata if magic bytes are ambiguous
 * @returns {{ format: string, extension: string, mimeType: string } | null}
 */
export function detectAudioFormat(buffer, fallbackMimeType = '') {
  if (!buffer) return null;

  const bytes = buffer instanceof Uint8Array
    ? buffer
    : buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : null;

  if (bytes && bytes.length >= 4) {
    // 1. WebM / Matroska: 0x1A 0x45 0xDF 0xA3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return {
        format: 'webm',
        extension: 'webm',
        mimeType: 'audio/webm',
      };
    }

    // 2. Ogg: 'OggS' (0x4F 0x67 0x67 0x53)
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return {
        format: 'ogg',
        extension: 'ogg',
        mimeType: 'audio/ogg',
      };
    }

    // 3. MP4 / M4A: 'ftyp' at offset 4 (bytes 4..7 === 0x66 0x74 0x79 0x70)
    if (bytes.length >= 8 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return {
        format: 'm4a',
        extension: 'm4a',
        mimeType: 'audio/mp4',
      };
    }

    // 4. MP3 with ID3v2 header: 'ID3' (0x49 0x44 0x33)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return {
        format: 'mp3',
        extension: 'mp3',
        mimeType: 'audio/mpeg',
      };
    }

    // 5. AAC ADTS: 12-bit sync word 0xFFF (bytes[0] === 0xFF, bytes[1] & 0xF6 === 0xF0, layer bits 17-18 are 00)
    if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
      return {
        format: 'aac',
        extension: 'm4a',
        mimeType: 'audio/aac',
      };
    }

    // 6. MP3 raw sync word: 11 consecutive 1 bits (0xFF followed by high 3 bits set, layer III: (bytes[1] & 0x06) === 0x02)
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) === 0x02) {
      return {
        format: 'mp3',
        extension: 'mp3',
        mimeType: 'audio/mpeg',
      };
    }

    // 6. WAV / RIFF: 'RIFF' at 0..3 and 'WAVE' at 8..11
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return {
        format: 'wav',
        extension: 'wav',
        mimeType: 'audio/wav',
      };
    }

    // 8. FLAC: 'fLaC' (0x66 0x4C 0x61 0x43)
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return {
        format: 'flac',
        extension: 'flac',
        mimeType: 'audio/flac',
      };
    }
  }

  // Fallback to explicit audio MIME type if provided and valid (never accept generic application/octet-stream)
  if (fallbackMimeType && typeof fallbackMimeType === 'string') {
    const lower = fallbackMimeType.toLowerCase().trim();
    if (lower.startsWith('audio/webm') || lower.includes('webm')) {
      return { format: 'webm', extension: 'webm', mimeType: 'audio/webm' };
    }
    if (lower.startsWith('audio/mp4') || lower.includes('m4a') || lower.includes('aac')) {
      return { format: 'm4a', extension: 'm4a', mimeType: 'audio/mp4' };
    }
    if (lower.startsWith('audio/ogg') || lower.includes('ogg')) {
      return { format: 'ogg', extension: 'ogg', mimeType: 'audio/ogg' };
    }
    if (lower.startsWith('audio/mpeg') || lower.includes('mp3')) {
      return { format: 'mp3', extension: 'mp3', mimeType: 'audio/mpeg' };
    }
    if (lower.startsWith('audio/wav') || lower.includes('wav')) {
      return { format: 'wav', extension: 'wav', mimeType: 'audio/wav' };
    }
    if (lower.startsWith('audio/flac') || lower.includes('flac')) {
      return { format: 'flac', extension: 'flac', mimeType: 'audio/flac' };
    }
  }

  return null;
}

/**
 * Safely extracts the first N bytes from a Blob as an ArrayBuffer,
 * handling cross-environment differences (modern browsers, older engines, JSDOM).
 *
 * @param {Blob} blob
 * @param {number} [maxBytes=64]
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function getBlobHeaderBytes(blob, maxBytes = 64) {
  if (!blob) return null;
  const slice = blob.slice ? blob.slice(0, maxBytes) : blob;
  if (typeof slice.arrayBuffer === 'function') {
    try {
      const buf = await slice.arrayBuffer();
      if (buf && buf.byteLength > 0) return buf;
    } catch (_e) {}
  }
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const full = await blob.arrayBuffer();
      if (full && full.byteLength > 0) return full.slice(0, maxBytes);
    } catch (_e) {}
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(slice);
      } catch (_e) {
        resolve(null);
      }
    });
  }
  return null;
}

/**
 * Sanitizes a title string into a clean, filesystem-safe filename segment.
 * E.g. "Pointers to the Dark" -> "pointers-to-the-dark"
 * E.g. "The longer October 31 reflection on darkness, surrender, and wholeness" -> "the-longer-october-31-reflection-on-darkness"
 *
 * @param {string} text
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function sanitizeTitleForFilename(text, maxLength = 50) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD') // decompose accented letters into base + diacritic
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // convert spaces & special characters to hyphens
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, maxLength)
    .replace(/-+$/, ''); // trim trailing hyphen after truncation
}

/**
 * Generates a descriptive, sanitized filename for an Echo audio download.
 * Prefers the Echo title or first line of text (e.g. pointers-to-the-dark.webm),
 * and falls back cleanly to astronomical metadata (echo_full-moon_leo_day14_2026-10-31.webm).
 *
 * @param {object} echo
 * @param {string} extension (e.g. 'webm', 'm4a', 'mp3')
 * @returns {string}
 */
export function generateAudioDownloadFilename(echo, extension = 'webm') {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;

  // 1. Candidate title from explicit title property or text
  let titleCandidate = '';
  if (echo?.title && typeof echo.title === 'string' && echo.title.trim()) {
    titleCandidate = echo.title.trim();
  } else if (echo?.text && typeof echo.text === 'string' && echo.text.trim()) {
    // Extract first line or sentence up to 80 chars
    const firstLine = echo.text.split(/[\r\n]+/)[0].trim();
    // Strip trailing punctuation
    titleCandidate = firstLine.replace(/[.,:;!?]+$/, '').trim();
  }

  // Filter out placeholder text
  let sanitized = '';
  const lowerCand = titleCandidate.toLowerCase();
  if (lowerCand && lowerCand !== 'voice reflection' && lowerCand !== 'reflection') {
    sanitized = sanitizeTitleForFilename(titleCandidate, 50);
  }

  // 2. Fallback to astronomical metadata if no meaningful title exists
  if (!sanitized) {
    const date = (() => {
      if (!echo?.createdAt) return 'unknown';
      const d = new Date(echo.createdAt);
      return isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
    })();
    const phase = (echo?.phase || 'moon').toLowerCase().replace(/\s+/g, '-');
    const zodiac = (echo?.zodiac || '').toLowerCase();
    const day = echo?.dayOfCycle ? `day${echo.dayOfCycle}` : '';
    const parts = ['echo', phase, zodiac, day, date].filter(Boolean);
    sanitized = parts.join('_');
  }

  return `${sanitized}.${ext}`;
}

/**
 * Triggers a client-side file download safely on both desktop and mobile browsers (including Android Chrome).
 *
 * Solves the Android Chrome `.bin` bug:
 * 1. Guarantees the Blob has an explicit, valid audio MIME type (never application/octet-stream or empty).
 * 2. Appends the anchor tag to document.body (required for mobile Chrome/WebKit download handling).
 * 3. Does NOT revoke the Object URL immediately (which terminates Android's background DownloadManager before it reads the stream).
 *    Instead, revokes the Object URL after a 60-second delay.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadAudioFile(blob, filename, mimeType) {
  if (!blob) throw new Error('Cannot download empty audio blob');

  // Ensure the blob is typed with the verified audio MIME type
  const typedBlob = blob.type === mimeType
    ? blob
    : new Blob([blob], { type: mimeType });

  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  if (typeof document !== 'undefined' && document.body) {
    document.body.appendChild(a);
  }

  a.click();

  // Defer cleanup by 60 seconds to allow Android DownloadManager to finish fetching the blob stream
  setTimeout(() => {
    try {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    } catch (_e) {}
    try {
      URL.revokeObjectURL(url);
    } catch (_e) {}
  }, 60000);
}
