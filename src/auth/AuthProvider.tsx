import type { Session, User } from "@supabase/supabase-js";
import {
	createContext,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
} from "solid-js";
import type { AuthContextValue, AuthProviderProps } from "./types";

const AuthContext = createContext<AuthContextValue>();

/**
 * Minimal Supabase auth provider for SolidJS.
 *
 * Manages session state and exposes auth methods. App-specific lifecycle
 * (SQLite init, sync worker start/stop) should be wired via the `onSignIn`
 * and `onSignOut` props rather than subclassing or extending this provider.
 */
export const AuthProvider: ParentComponent<AuthProviderProps> = (props) => {
	const [user, setUser] = createSignal<User | null>(null);
	const [session, setSession] = createSignal<Session | null>(null);
	const [loading, setLoading] = createSignal(true);

	const isAnonymous = () => {
		const u = user();
		if (!u) return false;
		// Supabase sets app_metadata.is_anonymous for anonymous users
		return (
			(u.app_metadata?.is_anonymous as boolean | undefined) === true ||
			(!u.email && (!u.identities || u.identities.length === 0))
		);
	};

	let cleanup: (() => void) | undefined;

	onMount(() => {
		// Hydrate from the existing session immediately (no flash)
		props.supabaseClient.auth.getSession().then(({ data }) => {
			setSession(data.session);
			setUser(data.session?.user ?? null);
			setLoading(false);
			if (data.session?.user && props.onSignIn) {
				props.onSignIn(data.session.user, data.session).catch(console.error);
			}
		});

		// Subscribe to future auth state changes
		const { data: listener } = props.supabaseClient.auth.onAuthStateChange(
			async (event, newSession) => {
				const prevUser = user();
				setSession(newSession);
				setUser(newSession?.user ?? null);
				setLoading(false);

				if (
					(event === "SIGNED_IN" ||
						event === "TOKEN_REFRESHED" ||
						event === "USER_UPDATED") &&
					newSession?.user &&
					!prevUser
				) {
					// Only fire onSignIn when transitioning from signed-out → signed-in
					if (props.onSignIn) {
						await props
							.onSignIn(newSession.user, newSession)
							.catch(console.error);
					}
				} else if (event === "SIGNED_OUT") {
					if (props.onSignOut) {
						await props.onSignOut().catch(console.error);
					}
				}
			},
		);

		cleanup = () => listener.subscription.unsubscribe();
	});

	onCleanup(() => cleanup?.());

	const signIn = async (email: string, password: string) => {
		const { error } = await props.supabaseClient.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw error;
	};

	const signUp = async (email: string, password: string) => {
		const { error } = await props.supabaseClient.auth.signUp({
			email,
			password,
		});
		if (error) throw error;
	};

	const signInWithOAuth = async (provider: "google" | "github") => {
		const { error } = await props.supabaseClient.auth.signInWithOAuth({
			provider,
		});
		if (error) throw error;
	};

	const signInAnonymously = async () => {
		const { error } = await props.supabaseClient.auth.signInAnonymously();
		if (error) throw error;
	};

	const convertAnonymousToRegistered = async (
		email: string,
		password: string,
	) => {
		const { error } = await props.supabaseClient.auth.updateUser({
			email,
			password,
		});
		if (error) throw error;
	};

	const resetPassword = async (
		email: string,
		options?: { redirectTo?: string },
	) => {
		const redirectTo =
			options?.redirectTo ?? `${window.location.origin}/auth/callback`;
		const { error } = await props.supabaseClient.auth.resetPasswordForEmail(
			email,
			{ redirectTo },
		);
		if (error) throw error;
	};

	const signOut = async () => {
		const { error } = await props.supabaseClient.auth.signOut();
		if (error) throw error;
	};

	// Expose reactive state as SolidJS signal accessors so consumers can
	// destructure and call as functions: const { user, loading } = useAuth(); user();
	const value: AuthContextValue = {
		user,
		session,
		loading,
		isAnonymous,
		signIn,
		signUp,
		signInWithOAuth,
		signInAnonymously,
		convertAnonymousToRegistered,
		resetPassword,
		signOut,
		// Consumer-provided sync state (localDb, forceSyncDown, forceSyncUp, lastSyncTimestamp, lastSyncMode)
		...(props.syncState ?? {}),
	};

	return (
		<AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
	);
};

export { AuthContext };
