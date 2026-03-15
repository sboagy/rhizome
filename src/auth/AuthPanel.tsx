import { createSignal, Show } from "solid-js";
import { useAuth } from "./useAuth";

interface AuthPanelProps {
  /** Optional CSS class applied to the root element. */
  class?: string;
  /** OAuth providers to display. Defaults to ["google"]. */
  oauthProviders?: Array<"google" | "github">;
}

/**
 * Generic Supabase auth panel for SolidJS apps.
 *
 * Shows email/password sign-in form + OAuth buttons when signed out.
 * Shows a "signed in as" line + sign-out button when signed in.
 *
 * Must be rendered inside an `<AuthProvider>`.
 */
export default function AuthPanel(props: AuthPanelProps) {
  const auth = useAuth();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const providers = () => props.oauthProviders ?? (["google"] as const);

  const wrap = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = (e: Event) => {
    e.preventDefault();
    wrap(() => auth.signIn(email(), password()));
  };

  const doSignUp = () => wrap(() => auth.signUp(email(), password()));

  const doOAuth = (provider: "google" | "github") => wrap(() => auth.signInWithOAuth(provider));

  const doSignOut = () => wrap(() => auth.signOut());

  return (
    <div class={props.class}>
      <Show
        when={auth.user}
        fallback={
          <div class="space-y-3">
            <form class="grid gap-2" onSubmit={doSignIn}>
              <input
                class="rounded border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 text-sm"
                type="email"
                placeholder="Email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                disabled={busy()}
                autocomplete="email"
              />
              <input
                class="rounded border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 text-sm"
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={busy()}
                autocomplete="current-password"
              />
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                  disabled={busy()}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-60"
                  disabled={busy()}
                  onClick={doSignUp}
                >
                  Register
                </button>
              </div>
            </form>

            <Show when={providers().includes("google")}>
              <button
                type="button"
                class="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                disabled={busy()}
                onClick={() => doOAuth("google")}
              >
                Google
              </button>
            </Show>
            <Show when={providers().includes("github")}>
              <button
                type="button"
                class="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                disabled={busy()}
                onClick={() => doOAuth("github")}
              >
                GitHub
              </button>
            </Show>

            <Show when={error()}>
              <p class="text-red-500 text-xs">{error()}</p>
            </Show>
          </div>
        }
      >
        <div class="space-y-2">
          <p class="text-sm truncate">
            {auth.isAnonymous
              ? "Signed in anonymously"
              : (auth.user?.email ?? auth.user?.id ?? "Signed in")}
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
            disabled={busy()}
            onClick={doSignOut}
          >
            Sign out
          </button>
          <Show when={error()}>
            <p class="text-red-500 text-xs">{error()}</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
