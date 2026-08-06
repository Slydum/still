import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { toAppUrl } from '../app/appLocation';

const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export type CloudSession = Session;
export type CloudAuthEvent = AuthChangeEvent;

let client: SupabaseClient | undefined;

export function getSupabaseConfigurationError() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return 'Account access is not configured for this deployment.';
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

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(getSupabaseConfigurationError() ?? 'Account access could not load on this device.');
  }
  return supabase;
}

export async function getCloudSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signInCloudAccount(email: string, password: string) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpCloudAccount(email: string, password: string, displayName: string) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: toAppUrl('/auth/confirmed'),
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function requestCloudPasswordReset(email: string) {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: toAppUrl('/auth/recovery'),
  });
  if (error) throw new Error(error.message);
}

export async function updateCloudPassword(password: string) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOutCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export function subscribeToCloudSession(
  listener: (event: CloudAuthEvent, session: CloudSession | null) => void,
) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    listener(event, session);
  });

  return () => data.subscription.unsubscribe();
}
