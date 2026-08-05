import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export type CloudSession = Session;

let client: SupabaseClient | undefined;

export function getSupabaseConfigurationError() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return 'Cloud sync is not configured for this deployment.';
  }

  return undefined;
}

export function isSupabaseAvailable() {
  return !getSupabaseConfigurationError();
}

export function getSupabaseClient() {
  if (client) return client;
  if (!SUPABASE_PROJECT_URL || !SUPABASE_PUBLISHABLE_KEY) return undefined;

  client = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export async function getCloudSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function requestCloudMagicLink(email: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error(getSupabaseConfigurationError() ?? 'Cloud sync could not load on this device.');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/more#cloud-sync`,
      shouldCreateUser: true,
    },
  });

  if (error) throw new Error(error.message);
}

export async function signOutCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export function subscribeToCloudSession(
  listener: (session: CloudSession | null) => void,
) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });

  return () => data.subscription.unsubscribe();
}
