// Auth panel UI component
export { default as AuthPanel } from "./auth/AuthPanel";

// Full-page login / sign-up (parameterized branding)
export { default as LoginPage } from "./auth/LoginPage";
export type { LoginPageProps } from "./auth/LoginPage";

// Route guard (redirects to /login when unauthenticated)
export { ProtectedRoute } from "./auth/ProtectedRoute";

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
