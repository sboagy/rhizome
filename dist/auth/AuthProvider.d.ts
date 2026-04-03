import { ParentComponent } from 'solid-js';
import { AuthContextValue, AuthProviderProps } from './types';
declare const AuthContext: import('solid-js').Context<AuthContextValue | undefined>;
/**
 * Minimal Supabase auth provider for SolidJS.
 *
 * Manages session state and exposes auth methods. App-specific lifecycle
 * (SQLite init, sync worker start/stop) should be wired via the `onSignIn`
 * and `onSignOut` props rather than subclassing or extending this provider.
 */
export declare const AuthProvider: ParentComponent<AuthProviderProps>;
export { AuthContext };
//# sourceMappingURL=AuthProvider.d.ts.map