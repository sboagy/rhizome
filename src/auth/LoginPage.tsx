/**
 * LoginPage
 *
 * Shared full-screen login / sign-up page for SolidJS + Supabase apps.
 *
 * Provides anonymous device-only mode, email/password auth, OAuth
 * (Google / GitHub), forgot-password, and anonymous→registered conversion.
 *
 * App-specific branding (name, logo, tagline) is passed as props.
 * Must be rendered inside an `<AuthProvider>` and `<Router>`.
 */

import { A, useNavigate, useSearchParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	type JSX,
	Show,
} from "solid-js";
import { useAuth } from "./useAuth";

export interface LoginPageProps {
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

const LoginPage: Component<LoginPageProps> = (props) => {
	const {
		signIn,
		signUp,
		signInWithOAuth,
		signInAnonymously,
		convertAnonymousToRegistered,
		resetPassword,
		isAnonymous,
		loading,
	} = useAuth();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	// True when an anonymous user clicks "Create Account" to preserve their data
	const isConverting = () => searchParams.convert === "true" && isAnonymous();

	const [isSignUp, setIsSignUp] = createSignal(false);
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [showPassword, setShowPassword] = createSignal(false);
	const [showForgotPassword, setShowForgotPassword] = createSignal(false);
	const [resetEmail, setResetEmail] = createSignal("");
	const [resetSuccess, setResetSuccess] = createSignal(false);

	// Sync URL params → form mode
	createEffect(() => {
		if (isConverting()) {
			setIsSignUp(true);
			return;
		}
		const isSignUpFromUrl =
			searchParams.mode === "signup" || searchParams.signup === "true";
		setIsSignUp(isSignUpFromUrl);
	});

	const handleAnonymousSignIn = async () => {
		setError(null);
		setIsSubmitting(true);
		try {
			await signInAnonymously();
			navigate("/");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to sign in anonymously",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const emailVal = email().trim();
			const passwordVal = password().trim();

			if (!emailVal || !passwordVal) {
				setError("Email and password are required");
				return;
			}
			if (passwordVal.length < 6) {
				setError("Password must be at least 6 characters");
				return;
			}

			if (isSignUp()) {
				if (isConverting()) {
					await convertAnonymousToRegistered(emailVal, passwordVal);
				} else {
					await signUp(emailVal, passwordVal);
				}
			} else {
				await signIn(emailVal, passwordVal);
			}
			navigate("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOAuthSignIn = async (provider: "google" | "github") => {
		setError(null);
		setIsSubmitting(true);
		try {
			await signInWithOAuth(provider);
			// OAuth redirect happens automatically; if it returns, there was an error
		} catch (err) {
			setError(err instanceof Error ? err.message : "OAuth sign-in failed");
			setIsSubmitting(false);
		}
	};

	const toggleMode = (e: MouseEvent) => {
		e.preventDefault();
		const nextIsSignUp = !isSignUp();
		setIsSignUp(nextIsSignUp);
		setError(null);
		setPassword("");
		if (!isConverting()) {
			navigate(nextIsSignUp ? "/login?mode=signup" : "/login", {
				replace: false,
			});
		}
	};

	const handlePasswordReset = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const emailVal = resetEmail().trim();
			if (!emailVal) {
				setError("Email is required");
				return;
			}
			await resetPassword(emailVal);
			setResetSuccess(true);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to send reset email",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const resolvedAnonDescription = () =>
		props.anonDescription ??
		`Try ${props.appName} without an account. Your data will only be stored on this device and won't sync to other devices.`;

	const resolvedBackupDescription = () =>
		props.backupDescription ??
		"Create an account to save and sync your data across devices";

	return (
		<div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
			{/* App header above the card */}
			<div class="mb-6 text-center">
				<Show when={props.appLogo}>
					<div class="flex items-center justify-center mb-2">
						{props.appLogo}
					</div>
				</Show>
				<h1 class="text-3xl font-bold text-white">{props.appName}</h1>
				<Show when={props.appTagline}>
					<p class="text-gray-400 mt-1">{props.appTagline}</p>
				</Show>
			</div>

			{/* Forgot Password Modal */}
			<Show when={showForgotPassword()}>
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div
						class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
						role="dialog"
						aria-modal="true"
						aria-labelledby="reset-password-title"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								setShowForgotPassword(false);
								setResetSuccess(false);
								setError(null);
								setResetEmail("");
							}
							e.stopPropagation();
						}}
					>
						<Show
							when={!resetSuccess()}
							fallback={
								<div class="text-center">
									<div class="text-green-500 text-5xl mb-4">✓</div>
									<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
										Check Your Email
									</h2>
									<p class="text-gray-600 dark:text-gray-400 mb-6">
										We've sent password reset instructions to{" "}
										<strong>{resetEmail()}</strong>
									</p>
									<button
										type="button"
										onClick={() => {
											setShowForgotPassword(false);
											setResetSuccess(false);
											setResetEmail("");
										}}
										class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
									>
										Close
									</button>
								</div>
							}
						>
							<h2
								id="reset-password-title"
								class="text-xl font-bold text-gray-900 dark:text-white mb-2"
							>
								Reset Password
							</h2>
							<p class="text-gray-600 dark:text-gray-400 mb-4">
								Enter your email address and we'll send you a link to reset your
								password.
							</p>

							<Show when={error()}>
								<div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
									<p class="text-sm text-red-600 dark:text-red-400">
										{error()}
									</p>
								</div>
							</Show>

							<form onSubmit={handlePasswordReset} class="space-y-4">
								<div>
									<label
										for="reset-email"
										class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
									>
										Email
									</label>
									<input
										id="reset-email"
										type="email"
										value={resetEmail()}
										onInput={(e) => setResetEmail(e.currentTarget.value)}
										placeholder="you@example.com"
										class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
										disabled={isSubmitting()}
										required
									/>
								</div>
								<div class="flex gap-3">
									<button
										type="button"
										onClick={() => {
											setShowForgotPassword(false);
											setError(null);
											setResetEmail("");
										}}
										class="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={isSubmitting()}
										class="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md"
									>
										{isSubmitting() ? "Sending..." : "Send Reset Link"}
									</button>
								</div>
							</form>
						</Show>
					</div>
				</div>
			</Show>

			{/* Main login card */}
			<div class="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
				{/* Converting from anonymous — show context header */}
				<Show when={isConverting()}>
					<div class="mb-6 text-center">
						<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
							Backup Your Data
						</h2>
						<p class="text-gray-600 dark:text-gray-400">
							{resolvedBackupDescription()}
						</p>
						<div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
							<p class="text-sm text-blue-700 dark:text-blue-300">
								✨ Your local data will be preserved and start syncing
								automatically
							</p>
						</div>
					</div>
				</Show>

				{/* Anonymous + sign-up/sign-in toggle (hidden while converting) */}
				<Show when={!isConverting()}>
					<Show when={!isSignUp()}>
						{/* Anonymous mode divider + button */}
						<div class="relative mb-3">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-gray-300 dark:border-gray-600" />
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
									Run local only, as anonymous
								</span>
							</div>
						</div>
						<div class="mb-5">
							<button
								type="button"
								data-testid="login-anonymous-button"
								onClick={handleAnonymousSignIn}
								disabled={isSubmitting() || loading()}
								class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
							>
								<Show
									when={!isSubmitting() && !loading()}
									fallback={<span>Loading...</span>}
								>
									Use on this Device Only
								</Show>
							</button>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
								{resolvedAnonDescription()}
							</p>
						</div>
						{/* "Or sign up" divider */}
						<div class="relative mb-3">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-gray-300 dark:border-gray-600" />
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
									Or sign up
								</span>
							</div>
						</div>
					</Show>

					{/* Toggle between sign-in / sign-up */}
					<div class="text-center mb-4">
						<button
							type="button"
							onClick={toggleMode}
							class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
						>
							{isSignUp() ? (
								<>
									Already have an account?{" "}
									<span class="underline">Sign in</span>
								</>
							) : (
								<>
									Don't have an account? <span class="underline">Sign up</span>
								</>
							)}
						</button>
					</div>

					{/* "Or sign in with password" / "Sign up with email" divider */}
					<div class={`relative ${isSignUp() ? "mb-4" : "mb-5"}`}>
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-gray-300 dark:border-gray-600" />
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
								{isSignUp() ? "Sign up with email" : "Or sign in with password"}
							</span>
						</div>
					</div>
				</Show>

				{/* Error banner */}
				<Show when={error()}>
					<div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
						<p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
					</div>
				</Show>

				{/* Email / password form */}
				<form onSubmit={handleSubmit} class="space-y-4 mb-5">
					{/* Email */}
					<div>
						<label
							for="login-email"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Email
						</label>
						<input
							id="login-email"
							data-testid="login-email-input"
							type="email"
							value={email()}
							onInput={(e) => setEmail(e.currentTarget.value)}
							placeholder="you@example.com"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
							disabled={isSubmitting() || loading()}
							required
						/>
					</div>

					{/* Password */}
					<div>
						<label
							for="login-password"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Password
						</label>
						<div class="relative">
							<input
								id="login-password"
								data-testid="login-password-input"
								type={showPassword() ? "text" : "password"}
								value={password()}
								onInput={(e) => setPassword(e.currentTarget.value)}
								autocomplete={isSignUp() ? "new-password" : "current-password"}
								placeholder="••••••••"
								class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
								disabled={isSubmitting() || loading()}
								required
								minlength="6"
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword())}
								class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
								aria-label={showPassword() ? "Hide password" : "Show password"}
							>
								<Show
									when={showPassword()}
									fallback={
										/* Eye open */
										<svg
											class="w-5 h-5"
											width="20"
											height="20"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
											/>
										</svg>
									}
								>
									{/* Eye off */}
									<svg
										class="w-5 h-5"
										width="20"
										height="20"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"
										/>
									</svg>
								</Show>
							</button>
						</div>
					</div>

					{/* Forgot password (sign-in only) */}
					<Show when={!isSignUp()}>
						<div class="flex justify-end">
							<button
								type="button"
								onClick={() => setShowForgotPassword(true)}
								class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
							>
								Forgot password?
							</button>
						</div>
					</Show>

					{/* Submit */}
					<button
						type="submit"
						data-testid="login-submit-button"
						disabled={isSubmitting() || loading()}
						class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
					>
						<Show
							when={!isSubmitting() && !loading()}
							fallback={<span>Loading...</span>}
						>
							{isSignUp() ? "Create Account" : "Sign In"}
						</Show>
					</button>
				</form>

				{/* Social auth divider */}
				<div class="relative mb-5">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-300 dark:border-gray-600" />
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
							Or sign in with social authentication
						</span>
					</div>
				</div>

				{/* OAuth buttons */}
				<div class="space-y-3 mb-4">
					{/* Google */}
					<button
						type="button"
						onClick={() => handleOAuthSignIn("google")}
						disabled={isSubmitting() || loading()}
						class="w-full flex items-center justify-center gap-3 py-2 px-4 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<svg
							class="w-5 h-5"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								fill="currentColor"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="currentColor"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="currentColor"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="currentColor"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						<span>Continue with Google</span>
					</button>

					{/* GitHub */}
					<button
						type="button"
						onClick={() => handleOAuthSignIn("github")}
						disabled={isSubmitting() || loading()}
						class="w-full flex items-center justify-center gap-3 py-2 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<svg
							class="w-5 h-5"
							width="20"
							height="20"
							fill="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
						</svg>
						<span>Continue with GitHub</span>
					</button>
				</div>

				{/* Footer links */}
				<div class="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
					<A class="hover:underline" href="/privacy">
						Privacy Policy
					</A>
					<span aria-hidden="true">•</span>
					<A class="hover:underline" href="/terms">
						Terms of Service
					</A>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;
