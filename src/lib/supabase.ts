import { createClient } from '@supabase/supabase-js';
import { Perfil } from '../types';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('your-supabase-project')
);

// Initialize Supabase client if configured, else null
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Helper to check network connectivity
export function checkIsOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Get official server timestamp via RPC or fallback to ISO string
export async function getOfficialServerTime(): Promise<string> {
  if (supabase && checkIsOnline()) {
    try {
      const { data, error } = await supabase.rpc('obtener_hora_servidor');
      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('RPC obtener_hora_servidor falló, usando fecha local:', e);
    }
  }
  return new Date().toISOString();
}

export async function getCurrentUserProfile(userId: string): Promise<Perfil | null> {
  if (supabase && checkIsOnline()) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).single();
    if (data) return data as Perfil;
  }
  return null;
}
