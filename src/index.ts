// Auth panel UI component
export { default as AuthPanel } from "./auth/AuthPanel";

// Auth provider + context
export { AuthContext, AuthProvider } from "./auth/AuthProvider";

// Auth types
export type {
	AuthContextValue,
	AuthProviderProps,
	AuthState,
} from "./auth/types";

// Auth hook
export { useAuth } from "./auth/useAuth";
export type { SupabaseClientOptions } from "./supabase/client";
// Supabase client factory
export { createSupabaseClient } from "./supabase/client";
