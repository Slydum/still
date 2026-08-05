export const SUPABASE_PROJECT_URL = 'https://hkezdsmpdnpnwvmqgkrx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jFFuMaE4NEGZI7yc7SArRA_BVBIYlJH';

export type CloudUser = {
  id: string;
  email?: string;
};

export type CloudSession = {
  user: CloudUser;
};

type SupabaseError = {
  message: string;
};

type AuthResponse<T> = Promise<{
  data: T;
  error: SupabaseError | null;
}>;

type AuthSubscription = {
  unsubscribe(): void;
};

export type SupabaseClientLike = {
  auth: {
    getSession(): AuthResponse<{ session: CloudSession | null }>;
    signInWithOtp(input: {
      email: string;
      options?: {
        emailRedirectTo?: string;
        shouldCreateUser?: boolean;
      };
    }): AuthResponse<Record<string, unknown>>;
    signOut(): AuthResponse<Record<string, unknown>>;
    onAuthStateChange(
      callback: (event: string, session: CloudSession | null) => void,
    ): { data: { subscription: AuthSubscription } };
  };
  from(table: string): any;
  rpc(functionName: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: SupabaseError | null;
  }>;
};

type SupabaseBrowserGlobal = {
  createClient(
    url: string,
    publishableKey: string,
    options?: Record<string, unknown>,
  ): SupabaseClientLike;
};

declare global {
  interface Window {
    supabase?: SupabaseBrowserGlobal;
  }
}

let client: SupabaseClientLike | undefined;

export function isSupabaseAvailable() {
  return typeof window !== 'undefined' && Boolean(window.supabase?.createClient);
}

export function getSupabaseClient() {
  if (client) return client;
  if (!isSupabaseAvailable()) return undefined;

  client = window.supabase?.createClient(
    SUPABASE_PROJECT_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

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
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

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
