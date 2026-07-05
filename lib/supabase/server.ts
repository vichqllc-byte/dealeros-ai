import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export type SupabaseSessionState = 'valid' | 'missing' | 'expired' | 'invalid';

export function getSupabaseAccessToken() {
  return cookies().get('sb-access-token')?.value ?? null;
}

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  const accessToken = getSupabaseAccessToken();

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function getSupabaseAuthState() {
  const token = getSupabaseAccessToken();
  if (!token) return { state: 'missing' as const, user: null };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('expired')) return { state: 'expired' as const, user: null };
    return { state: 'invalid' as const, user: null };
  }

  return { state: 'valid' as const, user: data.user };
}
