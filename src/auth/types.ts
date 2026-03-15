import type { Accessor } from "solid-js";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

export interface AuthState {
  /** SolidJS signal accessor: call as `user()` to get the current User or null. */
  user: Accessor<User | null>;
  /** SolidJS signal accessor: call as `session()` to get the current Session or null. */
  session: Accessor<Session | null>;
  /** SolidJS signal accessor: `true` while the initial session is being resolved. */
  loading: Accessor<boolean>;
  /** Derived accessor: `true` when the current user is a Supabase anonymous user. */
  isAnonymous: Accessor<boolean>;
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
  /**
   * Sends a password-reset email.
   * @param email - The user's email address.
   * @param options.redirectTo - URL to redirect to after the user clicks the link (defaults to origin + /auth/callback).
   */
  resetPassword(email: string, options?: { redirectTo?: string }): Promise<void>;
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
