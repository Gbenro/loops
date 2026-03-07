// Cosmic Loops - Encryption Context
// Holds session key in memory only — never persisted

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from './supabase.js';
import {
  generateVerifyToken,
  unlockWithPassphrase,
  encryptText,
  decryptText,
} from './encryption.js';

const EncryptionContext = createContext(null);

export function EncryptionProvider({ children }) {
  const [sessionKey, setSessionKey] = useState(null);
  // 'unknown' | 'disabled' | 'locked' | 'unlocked'
  const [status, setStatus] = useState('unknown');

  // Called once profile loads — determines if encryption is configured
  const initFromProfile = useCallback((profile) => {
    if (!profile?.encryption_verify_token) {
      setStatus('disabled');
      setSessionKey(null);
      return;
    }
    // Token exists — need passphrase to derive key
    setStatus(prev => prev === 'unlocked' ? 'unlocked' : 'locked');
  }, []);

  // Setup encryption for the first time (userId passed at call time)
  const setupEncryption = useCallback(async (passphrase, userId) => {
    if (!userId) throw new Error('Not signed in');
    const token = await generateVerifyToken(passphrase, userId);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, encryption_verify_token: token });
    if (error) throw error;
    const key = await unlockWithPassphrase(passphrase, userId, token);
    setSessionKey(key);
    setStatus('unlocked');
    return token;
  }, []);

  // Unlock with passphrase using stored verify token
  const unlock = useCallback(async (passphrase, userId, verifyToken) => {
    if (!userId) return false;
    const key = await unlockWithPassphrase(passphrase, userId, verifyToken);
    if (key) {
      setSessionKey(key);
      setStatus('unlocked');
      return true;
    }
    return false;
  }, []);

  // Disable encryption — clears token from profile, key from session
  const disableEncryption = useCallback(async (userId) => {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ encryption_verify_token: null })
      .eq('id', userId);
    setSessionKey(null);
    setStatus('disabled');
  }, []);

  // Lock session (forget key without disabling)
  const lock = useCallback(() => {
    setSessionKey(null);
    setStatus('locked');
  }, []);

  const encryptField = useCallback((text) => encryptText(text, sessionKey), [sessionKey]);
  const decryptField = useCallback((text) => decryptText(text, sessionKey), [sessionKey]);

  return (
    <EncryptionContext.Provider value={{
      sessionKey,
      status,
      initFromProfile,
      setupEncryption,
      unlock,
      disableEncryption,
      lock,
      encryptField,
      decryptField,
    }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  return useContext(EncryptionContext);
}
