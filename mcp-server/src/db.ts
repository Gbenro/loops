import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

/**
 * Validates a Supabase Access Token (JWT) and returns the User ID if valid.
 */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
    
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      console.error('Supabase JWT validation failed:', error?.message);
      return null;
    }
    
    return data.user.id;
  } catch (err) {
    console.error('Error validating Supabase token:', err);
    return null;
  }
}

/**
 * Creates a user-scoped Supabase client that automatically applies RLS (Row Level Security)
 * using the user's active access token.
 */
export function getSupabaseForUser(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Creates a server-scoped Supabase client for telemetry logging and public reads.
 */
export function getSupabaseAnon(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false }
  });
}
