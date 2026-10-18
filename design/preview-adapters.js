// Only the isolated preview config resolves to this module. Never used by main.
// All content is invented. Preview writes live in memory, never in Supabase/IDB.
import { getLunarData } from '../src/lib/lunar.js';

const lunar = getLunarData();
const drafts = new Map();
const audio = new Map();
const urls = new Map();
let echoes = [{
  id: 'design-example-echo',
  text: 'Sample Echo: I stepped outside for a moment. The air had cooled, and I wanted to remember that pause.',
  source: 'text',
  createdAt: new Date().toISOString(),
  phase: lunar.phase.key,
  phaseName: lunar.phase.name,
  phaseType: lunar.phase.phaseType,
  lunarMonth: lunar.lunarMonth,
  dayOfCycle: lunar.dayOfCycle,
  zodiac: lunar.zodiac.sign,
  illumination: lunar.illumination,
  tags: [],
  provenanceAuthor: 'user',
  provenanceKind: 'original_echo',
}];

export const generateId = (prefix = 'e') => `design-${prefix}-${crypto.randomUUID()}`;
export const getEchoes = async () => [...echoes];
export const saveEcho = async (echo) => {
  echoes = [echo, ...echoes.filter((item) => item.id !== echo.id)];
  return echo;
};
export const deleteEcho = async (id) => { echoes = echoes.filter((item) => item.id !== id); };
export const updateEchoTags = async (id, tags) => {
  echoes = echoes.map((item) => item.id === id ? { ...item, tags } : item);
};
export const updateEchoText = async () => { throw new Error('Original sample Echoes stay unchanged.'); };
export const updateEchoAudioPath = async () => { throw new Error('Original sample audio stays unchanged.'); };

export const normalizeAudioBlob = (blob) => blob instanceof Blob ? blob : null;
export const saveAudio = async (echoId, blob, _userId, options = {}) => {
  const path = `design-preview/${echoId}`;
  audio.set(path, blob);
  return options.detailed ? { success: true, path } : path;
};
export const getAudio = async (path) => audio.get(path) || null;
export const getAudioUrl = async (path) => {
  if (!audio.has(path)) return null;
  if (!urls.has(path)) urls.set(path, URL.createObjectURL(audio.get(path)));
  return urls.get(path);
};
export const deleteAudio = async (path) => {
  if (urls.has(path)) URL.revokeObjectURL(urls.get(path));
  urls.delete(path);
  audio.delete(path);
};
export const saveDraftAudio = async (id, blob, metadata = {}) => {
  const draft = { ...metadata, id, blob, size: blob.size, createdAt: new Date().toISOString() };
  drafts.set(id, draft);
  return draft;
};
export const updateDraftAudio = async (id, updates) => {
  if (!drafts.has(id)) return null;
  const draft = { ...drafts.get(id), ...updates };
  drafts.set(id, draft);
  return draft;
};
export const deleteDraftAudio = async (id) => drafts.delete(id);
export const getAllDraftAudio = async () => [...drafts.values()];

export const transcribeAudio = async () => 'Preview transcript: this audio was not sent for transcription. Sample words stand in for a transcript.';
export const isModelLoaded = () => true;
export const preloadModel = () => Promise.resolve();
const encryption = { sessionKey: null, encryptField: async (text) => text, decryptField: async (text) => text };
export const useEncryption = () => encryption;

window.addEventListener('pagehide', () => {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
  audio.clear();
  drafts.clear();
});
