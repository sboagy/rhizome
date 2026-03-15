import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True when the current session is a Supabase anonymous user. */
  isAnonymous: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInWithOAuth(provider: "google" | "github"): Promise<void>;
  signInAnonymously(): Promise<void>;
  /**
   * Converts an anonymous Supabase user to a registered account.
   * Attaches the given email/password credentials to the current session.
   */
  convertAnonymousToRegistered(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface AuthProviderProps {
  supabaseClient: SupabaseClient;
  /**
   * Called after a successful sign-in (including anonymous sign-in).
   * Use this hook to initialize app-specific resources (e.g., SQLite DB, sync worker).
   */
  onSignIn?: (user: User, session: Session) => Promise<void>;
  /**
   * Called after sign-out completes.
   * Use this hook to tear down app-specific resources.
   */
  onSignOut?: () => Promise<void>;
}
