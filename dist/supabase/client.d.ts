import { SupabaseClient } from '@supabase/supabase-js';
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
export declare function createSupabaseClient(opts: SupabaseClientOptions): SupabaseClient;
//# sourceMappingURL=client.d.ts.map