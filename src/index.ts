// Auth panel UI component
export { default as AuthPanel } from "./auth/AuthPanel";
// Auth provider + context
export { AuthContext, AuthProvider } from "./auth/AuthProvider";
export type { LoginPageProps } from "./auth/LoginPage";
// Full-page login / sign-up (parameterized branding)
export { default as LoginPage } from "./auth/LoginPage";
// Route guard (redirects to /login when unauthenticated)
export { ProtectedRoute } from "./auth/ProtectedRoute";

// Auth types
export type {
	AuthContextValue,
	AuthProviderProps,
	AuthState,
	LocalDatabase,
	SyncState,
} from "./auth/types";

// Auth hook
export { useAuth } from "./auth/useAuth";
export type { SupabaseClientOptions } from "./supabase/client";
// Supabase client factory
export { createSupabaseClient } from "./supabase/client";
export type { DatabaseBrowserProps } from "./sync/DatabaseBrowser";
export { DatabaseBrowser } from "./sync/DatabaseBrowser";
export type { DbStatusDropdownProps } from "./sync/DbStatusDropdown";
// Sync UI — shared components for DB/sync status and SQLite WASM browser
export { DbStatusDropdown } from "./sync/DbStatusDropdown";
