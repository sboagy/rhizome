import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Accessor } from "solid-js";

/**
 * Minimal interface for a local SQLite database exposed by oosync consumers.
 * Used by shared components (DbStatusDropdown, DatabaseBrowser) without
 * taking a hard dependency on oosync's concrete BrowserSqliteDatabase type.
 */
export interface LocalDatabase {
	all<T = Record<string, unknown>>(sql: string): Promise<T[]>;
}

/**
 * Optional sync state provided by consumers that run an oosync sync worker.
 * Pass this via AuthProvider's syncState prop so shared UI components can
 * read sync status and invoke sync operations through useAuth().
 */
export interface SyncState {
	/** Local SQLite database instance. Null until the user signs in and the DB initializes. */
	localDb?: Accessor<LocalDatabase | null>;
	/** Force a sync down from the remote. Incremental by default; pass { full: true } for a full re-download. */
	forceSyncDown?: (opts?: { full?: boolean }) => Promise<void>;
	/** Force a sync up to the remote, pushing local changes immediately. */
	forceSyncUp?: (opts?: { allowDeletes?: boolean }) => Promise<void>;
	/** ISO timestamp of the last successful syncDown. */
	lastSyncTimestamp?: Accessor<string | null>;
	/** Mode of the last syncDown ('full' | 'incremental'). */
	lastSyncMode?: Accessor<"full" | "incremental" | null>;
}

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

export interface AuthContextValue extends AuthState, SyncState {
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
	resetPassword(
		email: string,
		options?: { redirectTo?: string },
	): Promise<void>;
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
	/**
	 * Optional sync state to inject into the auth context.
	 * Consumers that run a sync worker pass reactive signals and functions here
	 * so shared components (DbStatusDropdown, DatabaseBrowser) can use them via useAuth().
	 */
	syncState?: SyncState;
}
