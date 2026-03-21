import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseClientOptions {
	url: string;
	anonKey: string;
	/** Key used to namespace the auth session in localStorage. Should be unique per app. */
	storageKey: string;
}

/**
 * Creates a Supabase client. Each app should call this once and keep its own
 * instance — no shared singletons at the library level.
 */
export function createSupabaseClient(
	opts: SupabaseClientOptions,
): SupabaseClient {
	return createClient(opts.url, opts.anonKey, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true,
			storageKey: opts.storageKey,
		},
	});
}
