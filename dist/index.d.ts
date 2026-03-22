import { Accessor } from 'solid-js';
import { Component } from 'solid-js';
import { Context } from 'solid-js';
import { JSX } from 'solid-js';
import { ParentComponent } from 'solid-js';
import { Session } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';

export declare const AuthContext: Context<AuthContextValue | undefined>;

export declare interface AuthContextValue extends AuthState, SyncState {
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
    resetPassword(email: string, options?: {
        redirectTo?: string;
    }): Promise<void>;
    signOut(): Promise<void>;
}

/**
 * Generic Supabase auth panel for SolidJS apps.
 *
 * Shows email/password sign-in form + OAuth buttons when signed out.
 * Shows a "signed in as" line + sign-out button when signed in.
 *
 * Must be rendered inside an `<AuthProvider>`.
 */
export declare function AuthPanel(props: AuthPanelProps): JSX.Element;

declare interface AuthPanelProps {
    /** Optional CSS class applied to the root element. */
    class?: string;
    /** OAuth providers to display. Defaults to ["google"]. */
    oauthProviders?: Array<"google" | "github">;
}

/**
 * Minimal Supabase auth provider for SolidJS.
 *
 * Manages session state and exposes auth methods. App-specific lifecycle
 * (SQLite init, sync worker start/stop) should be wired via the `onSignIn`
 * and `onSignOut` props rather than subclassing or extending this provider.
 */
export declare const AuthProvider: ParentComponent<AuthProviderProps>;

export declare interface AuthProviderProps {
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

export declare interface AuthState {
    /** SolidJS signal accessor: call as `user()` to get the current User or null. */
    user: Accessor<User | null>;
    /** SolidJS signal accessor: call as `session()` to get the current Session or null. */
    session: Accessor<Session | null>;
    /** SolidJS signal accessor: `true` while the initial session is being resolved. */
    loading: Accessor<boolean>;
    /** Derived accessor: `true` when the current user is a Supabase anonymous user. */
    isAnonymous: Accessor<boolean>;
}

/**
 * Creates a Supabase client. Each app should call this once and keep its own
 * instance — no shared singletons at the library level.
 */
export declare function createSupabaseClient(opts: SupabaseClientOptions): SupabaseClient;

export declare const DatabaseBrowser: Component<DatabaseBrowserProps>;

export declare interface DatabaseBrowserProps {
    /**
     * App-specific preset SQL queries shown after the built-in sync queue presets.
     */
    presetQueries?: Array<{
        name: string;
        sql: string;
    }>;
}

export declare const DbStatusDropdown: Component<DbStatusDropdownProps>;

export declare interface DbStatusDropdownProps {
    /** Route path for the SQLite database browser page. Defaults to "/debug/db". */
    dbBrowserPath?: string;
}

/**
 * Minimal interface for a local SQLite database exposed by oosync consumers.
 * Used by shared components (DbStatusDropdown, DatabaseBrowser) without
 * taking a hard dependency on oosync's concrete BrowserSqliteDatabase type.
 */
export declare interface LocalDatabase {
    all<T = Record<string, unknown>>(sql: string): Promise<T[]>;
}

export declare const LoginPage: Component<LoginPageProps>;

export declare interface LoginPageProps {
    /** Application name shown as the page heading (e.g. "CubeFSRS", "TuneTrees"). */
    appName: string;
    /** Logo element rendered above the heading (e.g. `<img src="/favicon.svg" />`). */
    appLogo?: JSX.Element;
    /** Short tagline shown below the app name. */
    appTagline?: string;
    /**
     * Text shown below the "Use on this Device Only" button explaining anonymous mode.
     * Defaults to a generic message.
     */
    anonDescription?: string;
    /**
     * Description in the "Backup Your Data" section shown to anonymous users
     * converting to a registered account.
     * Defaults to a generic message.
     */
    backupDescription?: string;
}

export declare const ProtectedRoute: ParentComponent<ProtectedRouteProps>;

declare interface ProtectedRouteProps {
    /** Path to redirect to when unauthenticated. Defaults to "/login". */
    redirectTo?: string;
}

export declare interface SupabaseClientOptions {
    url: string;
    anonKey: string;
    /** Key used to namespace the auth session in localStorage. Should be unique per app. */
    storageKey: string;
}

/**
 * Optional sync state provided by consumers that run an oosync sync worker.
 * Pass this via AuthProvider's syncState prop so shared UI components can
 * read sync status and invoke sync operations through useAuth().
 */
export declare interface SyncState {
    /** Local SQLite database instance. Null until the user signs in and the DB initializes. */
    localDb?: Accessor<LocalDatabase | null>;
    /** Force a sync down from the remote. Incremental by default; pass { full: true } for a full re-download. */
    forceSyncDown?: (opts?: {
        full?: boolean;
    }) => Promise<void>;
    /** Force a sync up to the remote, pushing local changes immediately. */
    forceSyncUp?: (opts?: {
        allowDeletes?: boolean;
    }) => Promise<void>;
    /** ISO timestamp of the last successful syncDown. */
    lastSyncTimestamp?: Accessor<string | null>;
    /** Mode of the last syncDown ('full' | 'incremental'). */
    lastSyncMode?: Accessor<"full" | "incremental" | null>;
}

/**
 * Returns the current auth context value.
 * Must be called inside a component tree wrapped by `<AuthProvider>`.
 */
export declare function useAuth(): AuthContextValue;

export { }
