import { className as e, createComponent as t, delegateEvents as n, effect as r, insert as i, memo as a, setAttribute as o, template as s } from "solid-js/web";
import { For as c, Show as l, createContext as u, createEffect as d, createResource as f, createSignal as p, onCleanup as m, onMount as h, useContext as g } from "solid-js";
import { A as _, Navigate as v, useNavigate as y, useSearchParams as b } from "@solidjs/router";
import { createClient as x } from "@supabase/supabase-js";
//#region src/auth/AuthProvider.tsx
var S = u(), C = (e) => {
	let [n, r] = p(null), [i, a] = p(null), [o, s] = p(!0), c = () => {
		let e = n();
		return e ? e.app_metadata?.is_anonymous === !0 || !e.email && (!e.identities || e.identities.length === 0) : !1;
	}, l;
	h(() => {
		e.supabaseClient.auth.getSession().then(({ data: t }) => {
			a(t.session), r(t.session?.user ?? null), s(!1), t.session?.user && e.onSignIn && e.onSignIn(t.session.user, t.session).catch(console.error);
		});
		let { data: t } = e.supabaseClient.auth.onAuthStateChange(async (t, i) => {
			let o = n();
			a(i), r(i?.user ?? null), s(!1), (t === "SIGNED_IN" || t === "TOKEN_REFRESHED" || t === "USER_UPDATED") && i?.user && !o ? e.onSignIn && await e.onSignIn(i.user, i).catch(console.error) : t === "SIGNED_OUT" && e.onSignOut && await e.onSignOut().catch(console.error);
		});
		l = () => t.subscription.unsubscribe();
	}), m(() => l?.());
	let u = {
		user: n,
		session: i,
		loading: o,
		isAnonymous: c,
		signIn: async (t, n) => {
			let { error: r } = await e.supabaseClient.auth.signInWithPassword({
				email: t,
				password: n
			});
			if (r) throw r;
		},
		signUp: async (t, n) => {
			let { error: r } = await e.supabaseClient.auth.signUp({
				email: t,
				password: n
			});
			if (r) throw r;
		},
		signInWithOAuth: async (t) => {
			let { error: n } = await e.supabaseClient.auth.signInWithOAuth({ provider: t });
			if (n) throw n;
		},
		signInAnonymously: async () => {
			let { error: t } = await e.supabaseClient.auth.signInAnonymously();
			if (t) throw t;
		},
		convertAnonymousToRegistered: async (t, n) => {
			let { error: r } = await e.supabaseClient.auth.updateUser({
				email: t,
				password: n
			});
			if (r) throw r;
		},
		resetPassword: async (t, n) => {
			let r = n?.redirectTo ?? `${window.location.origin}/auth/callback`, { error: i } = await e.supabaseClient.auth.resetPasswordForEmail(t, { redirectTo: r });
			if (i) throw i;
		},
		signOut: async () => {
			let { error: t } = await e.supabaseClient.auth.signOut();
			if (t) throw t;
		},
		...e.syncState ?? {}
	};
	return t(S.Provider, {
		value: u,
		get children() {
			return e.children;
		}
	});
};
//#endregion
//#region src/auth/useAuth.ts
function w() {
	let e = g(S);
	if (!e) throw Error("useAuth() must be called inside <AuthProvider>");
	return e;
}
//#endregion
//#region src/auth/AuthPanel.tsx
var T = /* @__PURE__ */ s("<p class=\"text-red-500 text-xs\">"), E = /* @__PURE__ */ s("<div class=space-y-2><p class=\"text-sm truncate\"></p><button type=button class=\"px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60\">Sign out"), D = /* @__PURE__ */ s("<div>"), O = /* @__PURE__ */ s("<button type=button class=\"w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60\">Google"), k = /* @__PURE__ */ s("<button type=button class=\"w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60\">GitHub"), A = /* @__PURE__ */ s("<div class=space-y-3><form class=\"grid gap-2\"><input class=\"rounded border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 text-sm\"type=email placeholder=Email autocomplete=email><input class=\"rounded border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 text-sm\"type=password placeholder=Password autocomplete=current-password><div class=\"flex gap-2\"><button type=submit class=\"px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60\">Sign in</button><button type=button class=\"px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-60\">Register");
function j(n) {
	let o = w(), [s, c] = p(""), [u, d] = p(""), [f, m] = p(""), [h, g] = p(!1), _ = () => n.oauthProviders ?? ["google"], v = async (e) => {
		m(""), g(!0);
		try {
			await e();
		} catch (e) {
			m(e instanceof Error ? e.message : String(e));
		} finally {
			g(!1);
		}
	}, y = (e) => {
		e.preventDefault(), v(() => o.signIn(s(), u()));
	}, b = () => v(() => o.signUp(s(), u())), x = (e) => v(() => o.signInWithOAuth(e)), S = () => v(() => o.signOut());
	return (() => {
		var p = D();
		return i(p, t(l, {
			get when() {
				return o.user;
			},
			get fallback() {
				return (() => {
					var e = A(), n = e.firstChild, a = n.firstChild, o = a.nextSibling, p = o.nextSibling.firstChild, m = p.nextSibling;
					return n.addEventListener("submit", y), a.$$input = (e) => c(e.currentTarget.value), o.$$input = (e) => d(e.currentTarget.value), m.$$click = b, i(e, t(l, {
						get when() {
							return _().includes("google");
						},
						get children() {
							var e = O();
							return e.$$click = () => x("google"), r(() => e.disabled = h()), e;
						}
					}), null), i(e, t(l, {
						get when() {
							return _().includes("github");
						},
						get children() {
							var e = k();
							return e.$$click = () => x("github"), r(() => e.disabled = h()), e;
						}
					}), null), i(e, t(l, {
						get when() {
							return f();
						},
						get children() {
							var e = T();
							return i(e, f), e;
						}
					}), null), r((e) => {
						var t = h(), n = h(), r = h(), i = h();
						return t !== e.e && (a.disabled = e.e = t), n !== e.t && (o.disabled = e.t = n), r !== e.a && (p.disabled = e.a = r), i !== e.o && (m.disabled = e.o = i), e;
					}, {
						e: void 0,
						t: void 0,
						a: void 0,
						o: void 0
					}), r(() => a.value = s()), r(() => o.value = u()), e;
				})();
			},
			get children() {
				var e = E(), n = e.firstChild, s = n.nextSibling;
				return i(n, (() => {
					var e = a(() => !!o.isAnonymous());
					return () => e() ? "Signed in anonymously" : o.user()?.email ?? o.user()?.id ?? "Signed in";
				})()), s.$$click = S, i(e, t(l, {
					get when() {
						return f();
					},
					get children() {
						var e = T();
						return i(e, f), e;
					}
				}), null), r(() => s.disabled = h()), e;
			}
		})), r(() => e(p, n.class)), p;
	})();
}
n(["click", "input"]);
//#endregion
//#region src/auth/LoginPage.tsx
var M = /* @__PURE__ */ s("<div class=\"flex items-center justify-center mb-2\">"), N = /* @__PURE__ */ s("<p class=\"text-gray-400 mt-1\">"), P = /* @__PURE__ */ s("<h2 id=reset-password-title class=\"text-xl font-bold text-gray-900 dark:text-white mb-2\">Reset Password"), F = /* @__PURE__ */ s("<p class=\"text-gray-600 dark:text-gray-400 mb-4\">Enter your email address and we'll send you a link to reset your password."), I = /* @__PURE__ */ s("<div class=\"mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md\"><p class=\"text-sm text-red-600 dark:text-red-400\">"), L = /* @__PURE__ */ s("<form class=space-y-4><div><label for=reset-email class=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\">Email</label><input id=reset-email type=email placeholder=you@example.com class=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white\"required></div><div class=\"flex gap-3\"><button type=button class=\"flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md\">Cancel</button><button type=submit class=\"flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md\">"), R = /* @__PURE__ */ s("<div class=\"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4\"><div class=\"bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6\"role=dialog aria-modal=true aria-labelledby=reset-password-title>"), z = /* @__PURE__ */ s("<div class=\"mb-6 text-center\"><h2 class=\"text-xl font-bold text-gray-900 dark:text-white mb-2\">Backup Your Data</h2><p class=\"text-gray-600 dark:text-gray-400\"></p><div class=\"mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md\"><p class=\"text-sm text-blue-700 dark:text-blue-300\">✨ Your local data will be preserved and start syncing automatically"), ee = /* @__PURE__ */ s("<div class=\"relative mb-3\"><div class=\"absolute inset-0 flex items-center\"><div class=\"w-full border-t border-gray-300 dark:border-gray-600\"></div></div><div class=\"relative flex justify-center text-sm\"><span class=\"px-2 bg-white dark:bg-gray-800 text-gray-500\">Run local only, as anonymous"), te = /* @__PURE__ */ s("<div class=mb-5><button type=button data-testid=login-anonymous-button class=\"w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors\"></button><p class=\"text-xs text-gray-500 dark:text-gray-400 mt-2 text-center\">"), ne = /* @__PURE__ */ s("<div class=\"relative mb-3\"><div class=\"absolute inset-0 flex items-center\"><div class=\"w-full border-t border-gray-300 dark:border-gray-600\"></div></div><div class=\"relative flex justify-center text-sm\"><span class=\"px-2 bg-white dark:bg-gray-800 text-gray-500\">Or sign up"), re = /* @__PURE__ */ s("<div class=\"text-center mb-4\"><button type=button class=\"text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium\">"), ie = /* @__PURE__ */ s("<div><div class=\"absolute inset-0 flex items-center\"><div class=\"w-full border-t border-gray-300 dark:border-gray-600\"></div></div><div class=\"relative flex justify-center text-sm\"><span class=\"px-2 bg-white dark:bg-gray-800 text-gray-500\">"), ae = /* @__PURE__ */ s("<svg class=\"w-5 h-5\"width=20 height=20 fill=none stroke=currentColor viewBox=\"0 0 24 24\"aria-hidden=true><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d=\"M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21\">"), oe = /* @__PURE__ */ s("<div class=\"flex justify-end\"><button type=button class=\"text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium\">Forgot password?"), se = /* @__PURE__ */ s("<div class=\"min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4\"><div class=\"mb-6 text-center\"><h1 class=\"text-3xl font-bold text-white\"></h1></div><div class=\"w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg\"><form class=\"space-y-4 mb-5\"><div><label for=login-email class=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\">Email</label><input id=login-email data-testid=login-email-input type=email placeholder=you@example.com class=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white\"required></div><div><label for=login-password class=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\">Password</label><div class=relative><input id=login-password data-testid=login-password-input placeholder=•••••••• class=\"w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white\"required minlength=6><button type=button class=\"absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none\"></button></div></div><button type=submit data-testid=login-submit-button class=\"w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors\"></button></form><div class=\"relative mb-5\"><div class=\"absolute inset-0 flex items-center\"><div class=\"w-full border-t border-gray-300 dark:border-gray-600\"></div></div><div class=\"relative flex justify-center text-sm\"><span class=\"px-2 bg-white dark:bg-gray-800 text-gray-500\">Or sign in with social authentication</span></div></div><div class=\"space-y-3 mb-4\"><button type=button class=\"w-full flex items-center justify-center gap-3 py-2 px-4 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed\"><svg class=\"w-5 h-5\"width=20 height=20 viewBox=\"0 0 24 24\"aria-hidden=true><path fill=currentColor d=\"M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z\"></path><path fill=currentColor d=\"M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z\"></path><path fill=currentColor d=\"M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z\"></path><path fill=currentColor d=\"M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z\"></path></svg><span>Continue with Google</span></button><button type=button class=\"w-full flex items-center justify-center gap-3 py-2 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed\"><svg class=\"w-5 h-5\"width=20 height=20 fill=currentColor viewBox=\"0 0 24 24\"aria-hidden=true><path d=\"M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z\"></path></svg><span>Continue with GitHub</span></button></div><div class=\"flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400\"><span aria-hidden=true>•"), ce = /* @__PURE__ */ s("<div class=text-center><div class=\"text-green-500 text-5xl mb-4\">✓</div><h2 class=\"text-xl font-bold text-gray-900 dark:text-white mb-2\">Check Your Email</h2><p class=\"text-gray-600 dark:text-gray-400 mb-6\">We've sent password reset instructions to <strong></strong></p><button type=button class=\"w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md\">Close"), B = /* @__PURE__ */ s("<span>Loading..."), le = /* @__PURE__ */ s("<span class=underline>Sign in"), ue = /* @__PURE__ */ s("<span class=underline>Sign up"), de = /* @__PURE__ */ s("<svg class=\"w-5 h-5\"width=20 height=20 fill=none stroke=currentColor viewBox=\"0 0 24 24\"aria-hidden=true><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d=\"M15 12a3 3 0 11-6 0 3 3 0 016 0z\"></path><path stroke-linecap=round stroke-linejoin=round stroke-width=2 d=\"M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z\">"), V = (n) => {
	let { signIn: s, signUp: c, signInWithOAuth: u, signInAnonymously: f, convertAnonymousToRegistered: m, resetPassword: h, isAnonymous: g, loading: v } = w(), [x] = b(), S = y(), C = () => x.convert === "true" && g(), [T, E] = p(!1), [D, O] = p(""), [k, A] = p(""), [j, V] = p(null), [H, U] = p(!1), [W, G] = p(!1), [K, q] = p(!1), [J, Y] = p(""), [X, Z] = p(!1);
	d(() => {
		if (C()) {
			E(!0);
			return;
		}
		E(x.mode === "signup" || x.signup === "true");
	});
	let Q = async () => {
		V(null), U(!0);
		try {
			await f(), S("/");
		} catch (e) {
			V(e instanceof Error ? e.message : "Failed to sign in anonymously");
		} finally {
			U(!1);
		}
	}, fe = async (e) => {
		e.preventDefault(), V(null), U(!0);
		try {
			let e = D().trim(), t = k().trim();
			if (!e || !t) {
				V("Email and password are required");
				return;
			}
			if (t.length < 6) {
				V("Password must be at least 6 characters");
				return;
			}
			T() ? C() ? await m(e, t) : await c(e, t) : await s(e, t), S("/");
		} catch (e) {
			V(e instanceof Error ? e.message : "Authentication failed");
		} finally {
			U(!1);
		}
	}, $ = async (e) => {
		V(null), U(!0);
		try {
			await u(e);
		} catch (e) {
			V(e instanceof Error ? e.message : "OAuth sign-in failed"), U(!1);
		}
	}, pe = (e) => {
		e.preventDefault();
		let t = !T();
		E(t), V(null), A(""), C() || S(t ? "/login?mode=signup" : "/login", { replace: !1 });
	}, me = async (e) => {
		e.preventDefault(), V(null), U(!0);
		try {
			let e = J().trim();
			if (!e) {
				V("Email is required");
				return;
			}
			await h(e), Z(!0);
		} catch (e) {
			V(e instanceof Error ? e.message : "Failed to send reset email");
		} finally {
			U(!1);
		}
	}, he = () => n.anonDescription ?? `Try ${n.appName} without an account. Your data will only be stored on this device and won't sync to other devices.`, ge = () => n.backupDescription ?? "Create an account to save and sync your data across devices";
	return (() => {
		var s = se(), c = s.firstChild, u = c.firstChild, d = c.nextSibling, f = d.firstChild, p = f.firstChild, m = p.firstChild.nextSibling, h = p.nextSibling, g = h.firstChild.nextSibling.firstChild, y = g.nextSibling, b = h.nextSibling, x = f.nextSibling.nextSibling, S = x.firstChild, w = S.nextSibling, E = x.nextSibling, U = E.firstChild;
		return i(c, t(l, {
			get when() {
				return n.appLogo;
			},
			get children() {
				var e = M();
				return i(e, () => n.appLogo), e;
			}
		}), u), i(u, () => n.appName), i(c, t(l, {
			get when() {
				return n.appTagline;
			},
			get children() {
				var e = N();
				return i(e, () => n.appTagline), e;
			}
		}), null), i(s, t(l, {
			get when() {
				return K();
			},
			get children() {
				var e = R(), n = e.firstChild;
				return n.$$keydown = (e) => {
					e.key === "Escape" && (q(!1), Z(!1), V(null), Y("")), e.stopPropagation();
				}, n.$$click = (e) => e.stopPropagation(), i(n, t(l, {
					get when() {
						return !X();
					},
					get fallback() {
						return (() => {
							var e = ce(), t = e.firstChild.nextSibling.nextSibling, n = t.firstChild.nextSibling, r = t.nextSibling;
							return i(n, J), r.$$click = () => {
								q(!1), Z(!1), Y("");
							}, e;
						})();
					},
					get children() {
						return [
							P(),
							F(),
							t(l, {
								get when() {
									return j();
								},
								get children() {
									var e = I(), t = e.firstChild;
									return i(t, j), e;
								}
							}),
							(() => {
								var e = L(), t = e.firstChild, n = t.firstChild.nextSibling, a = t.nextSibling.firstChild, o = a.nextSibling;
								return e.addEventListener("submit", me), n.$$input = (e) => Y(e.currentTarget.value), a.$$click = () => {
									q(!1), V(null), Y("");
								}, i(o, () => H() ? "Sending..." : "Send Reset Link"), r((e) => {
									var t = H(), r = H();
									return t !== e.e && (n.disabled = e.e = t), r !== e.t && (o.disabled = e.t = r), e;
								}, {
									e: void 0,
									t: void 0
								}), r(() => n.value = J()), e;
							})()
						];
					}
				})), e;
			}
		}), d), i(d, t(l, {
			get when() {
				return C();
			},
			get children() {
				var e = z(), t = e.firstChild.nextSibling;
				return i(t, ge), e;
			}
		}), f), i(d, t(l, {
			get when() {
				return !C();
			},
			get children() {
				return [
					t(l, {
						get when() {
							return !T();
						},
						get children() {
							return [
								ee(),
								(() => {
									var e = te(), n = e.firstChild, o = n.nextSibling;
									return n.$$click = Q, i(n, t(l, {
										get when() {
											return a(() => !H())() && !v();
										},
										get fallback() {
											return B();
										},
										children: "Use on this Device Only"
									})), i(o, he), r(() => n.disabled = H() || v()), e;
								})(),
								ne()
							];
						}
					}),
					(() => {
						var e = re(), t = e.firstChild;
						return t.$$click = pe, i(t, (() => {
							var e = a(() => !!T());
							return () => e() ? [
								"Already have an account?",
								" ",
								le()
							] : ["Don't have an account? ", ue()];
						})()), e;
					})(),
					(() => {
						var t = ie(), n = t.firstChild.nextSibling.firstChild;
						return i(n, () => T() ? "Sign up with email" : "Or sign in with password"), r(() => e(t, `relative ${T() ? "mb-4" : "mb-5"}`)), t;
					})()
				];
			}
		}), f), i(d, t(l, {
			get when() {
				return j();
			},
			get children() {
				var e = I(), t = e.firstChild;
				return i(t, j), e;
			}
		}), f), f.addEventListener("submit", fe), m.$$input = (e) => O(e.currentTarget.value), g.$$input = (e) => A(e.currentTarget.value), y.$$click = () => G(!W()), i(y, t(l, {
			get when() {
				return W();
			},
			get fallback() {
				return de();
			},
			get children() {
				return ae();
			}
		})), i(f, t(l, {
			get when() {
				return !T();
			},
			get children() {
				var e = oe(), t = e.firstChild;
				return t.$$click = () => q(!0), e;
			}
		}), b), i(b, t(l, {
			get when() {
				return a(() => !H())() && !v();
			},
			get fallback() {
				return B();
			},
			get children() {
				return T() ? "Create Account" : "Sign In";
			}
		})), S.$$click = () => $("google"), w.$$click = () => $("github"), i(E, t(_, {
			class: "hover:underline",
			href: "/privacy",
			children: "Privacy Policy"
		}), U), i(E, t(_, {
			class: "hover:underline",
			href: "/terms",
			children: "Terms of Service"
		}), null), r((e) => {
			var t = H() || v(), n = W() ? "text" : "password", r = T() ? "new-password" : "current-password", i = H() || v(), a = W() ? "Hide password" : "Show password", s = H() || v(), c = H() || v(), l = H() || v();
			return t !== e.e && (m.disabled = e.e = t), n !== e.t && o(g, "type", e.t = n), r !== e.a && o(g, "autocomplete", e.a = r), i !== e.o && (g.disabled = e.o = i), a !== e.i && o(y, "aria-label", e.i = a), s !== e.n && (b.disabled = e.n = s), c !== e.s && (S.disabled = e.s = c), l !== e.h && (w.disabled = e.h = l), e;
		}, {
			e: void 0,
			t: void 0,
			a: void 0,
			o: void 0,
			i: void 0,
			n: void 0,
			s: void 0,
			h: void 0
		}), r(() => m.value = D()), r(() => g.value = k()), s;
	})();
};
n([
	"click",
	"keydown",
	"input"
]);
//#endregion
//#region src/auth/ProtectedRoute.tsx
var H = /* @__PURE__ */ s("<div class=\"flex items-center justify-center min-h-screen\"><div class=text-center><svg class=\"animate-spin h-12 w-12 mx-auto text-blue-600\"viewBox=\"0 0 24 24\"aria-hidden=true><circle class=opacity-25 cx=12 cy=12 r=10 stroke=currentColor stroke-width=4 fill=none></circle><path class=opacity-75 fill=currentColor d=\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z\"></path></svg><p class=\"mt-4 text-gray-600 dark:text-gray-400\">Loading..."), U = (e) => {
	let { user: n, loading: r } = w(), i = () => e.redirectTo ?? "/login";
	return t(l, {
		get when() {
			return !r();
		},
		get fallback() {
			return H();
		},
		get children() {
			return t(l, {
				get when() {
					return n();
				},
				get fallback() {
					return t(v, { get href() {
						return i();
					} });
				},
				get children() {
					return e.children;
				}
			});
		}
	});
};
//#endregion
//#region src/supabase/client.ts
function W(e) {
	return x(e.url, e.anonKey, { auth: {
		autoRefreshToken: !0,
		persistSession: !0,
		detectSessionInUrl: !0,
		storageKey: e.storageKey
	} });
}
//#endregion
//#region src/sync/DatabaseBrowser.tsx
var G = /* @__PURE__ */ s("<div class=space-y-0.5>"), K = /* @__PURE__ */ s("<p class=\"text-xs text-gray-500 dark:text-gray-400 break-words\">"), q = /* @__PURE__ */ s("<span class=\"text-xs text-gray-400 dark:text-gray-500\">ms"), J = /* @__PURE__ */ s("<div class=\"flex-shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300\"><strong>Error:</strong> "), Y = /* @__PURE__ */ s("<div class=\"fixed inset-0 flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100\"><div class=\"px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700\"><h1 class=\"text-2xl font-bold\">SQLite WASM Database Browser</h1><p class=\"text-sm text-gray-600 dark:text-gray-400 mt-1\">💡 Each browser tab has its own database copy. After making changes elsewhere, <button type=button class=\"text-blue-600 dark:text-blue-400 hover:underline\">refresh this page</button> to see the latest data from IndexedDB.</p></div><div class=\"flex-1 flex overflow-hidden\"><div class=\"w-64 flex flex-col gap-4 p-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700 flex-shrink-0\"><div class=\"bg-gray-50 dark:bg-gray-800 rounded-lg p-3\"><h2 class=\"text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2\">Tables</h2></div><div class=\"bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex-1\"><h2 class=\"text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2\">Preset Queries</h2><div class=space-y-0.5></div><div class=\"mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2\"><button type=button class=\"w-full px-3 py-2 text-sm rounded bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-300 font-medium transition-colors\">🔄 Retry Failed Sync Items</button></div></div></div><div class=\"flex-1 flex flex-col gap-4 p-4 overflow-hidden\"><div class=\"bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex-shrink-0\"><h2 class=\"text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2\">SQL Query</h2><textarea class=\"w-full h-28 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500\"placeholder=\"Enter SQL query…\"></textarea><div class=\"mt-2 flex items-center gap-3\"><button type=button class=\"px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors\">▶ Execute</button><span class=\"ml-auto text-xs text-gray-400 dark:text-gray-500\">Ctrl+Enter to run"), X = /* @__PURE__ */ s("<p class=\"text-sm text-gray-400\">Loading…"), Z = /* @__PURE__ */ s("<button type=button class=\"w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300\">📋 "), Q = /* @__PURE__ */ s("<button type=button class=\"w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300\">⚡ "), fe = /* @__PURE__ */ s("<div class=overflow-auto><table class=\"w-full text-xs border-collapse\"><thead><tr class=\"bg-gray-200 dark:bg-gray-700 sticky top-0\"></tr></thead><tbody>"), $ = /* @__PURE__ */ s("<div class=\"flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4\"><h2 class=\"text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2\">Results — <!> row"), pe = /* @__PURE__ */ s("<p class=\"text-sm text-gray-500 dark:text-gray-400\">Query executed successfully (no rows returned)."), me = /* @__PURE__ */ s("<th class=\"text-left p-2 border border-gray-300 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap\">"), he = /* @__PURE__ */ s("<tr>"), ge = /* @__PURE__ */ s("<td class=\"p-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 max-w-xs truncate\">"), _e = /* @__PURE__ */ s("<span class=\"text-gray-400 italic\">NULL"), ve = [
	{
		name: "List Tables",
		sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
	},
	{
		name: "Sync Queue (All)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at, last_error FROM sync_push_queue ORDER BY changed_at DESC LIMIT 50;"
	},
	{
		name: "Sync Queue (Pending)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at FROM sync_push_queue WHERE status = 'pending' ORDER BY changed_at;"
	},
	{
		name: "Sync Queue (Failed)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, last_error, changed_at FROM sync_push_queue WHERE status = 'failed' ORDER BY changed_at DESC;"
	}
], ye = (n) => {
	let { localDb: s } = w(), [u, d] = p("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"), [m, h] = p(null), [g, _] = p(null), [v, y] = p(0), [b, x] = p(null), [S] = f(s, async (e) => e ? (await e.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")).map((e) => e.name) : []), C = () => [...ve, ...n.presetQueries ?? []], T = async () => {
		_(null), h(null), x(null);
		let e = s?.();
		if (!e) {
			_("Database not initialized. Please sign in first.");
			return;
		}
		try {
			let t = performance.now(), n = await e.all(u());
			if (y(performance.now() - t), n.length === 0) {
				h({
					columns: [],
					rows: []
				});
				return;
			}
			h({
				columns: Object.keys(n[0]),
				rows: n
			});
		} catch (e) {
			_(e instanceof Error ? e.message : String(e));
		}
	}, E = (e) => {
		d(`SELECT * FROM ${e} LIMIT 100;`), setTimeout(() => T(), 0);
	}, D = async () => {
		x(null);
		let e = s?.();
		if (!e) {
			x("Database not initialized.");
			return;
		}
		try {
			await e.all("UPDATE sync_push_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'failed'"), x("Reset failed sync items for retry."), u().toLowerCase().includes("sync_push_queue") && T();
		} catch (e) {
			x(`Error: ${e instanceof Error ? e.message : String(e)}`);
		}
	};
	return (() => {
		var n = Y(), s = n.firstChild, f = s.firstChild.nextSibling.firstChild.nextSibling, p = s.nextSibling.firstChild, h = p.firstChild;
		h.firstChild;
		var _ = h.nextSibling.firstChild.nextSibling, y = _.nextSibling, x = y.firstChild, w = p.nextSibling, O = w.firstChild.firstChild.nextSibling, k = O.nextSibling, A = k.firstChild, j = A.nextSibling;
		return f.$$click = () => window.location.reload(), i(h, t(l, {
			get when() {
				return !S.loading;
			},
			get fallback() {
				return X();
			},
			get children() {
				var e = G();
				return i(e, t(c, {
					get each() {
						return S();
					},
					children: (e) => (() => {
						var t = Z();
						return t.firstChild, t.$$click = () => E(e), i(t, e, null), t;
					})()
				})), e;
			}
		}), null), i(_, t(c, {
			get each() {
				return C();
			},
			children: (e) => (() => {
				var t = Q();
				return t.firstChild, t.$$click = () => d(e.sql), i(t, () => e.name, null), t;
			})()
		})), x.$$click = D, i(y, t(l, {
			get when() {
				return b();
			},
			get children() {
				var e = K();
				return i(e, b), e;
			}
		}), null), O.$$keydown = (e) => {
			(e.ctrlKey || e.metaKey) && e.key === "Enter" && (e.preventDefault(), T());
		}, O.$$input = (e) => d(e.currentTarget.value), o(O, "spellcheck", !1), A.$$click = T, i(k, t(l, {
			get when() {
				return a(() => !!m())() && v() > 0;
			},
			get children() {
				var e = q(), t = e.firstChild;
				return i(e, () => v().toFixed(2), t), e;
			}
		}), j), i(w, t(l, {
			get when() {
				return g();
			},
			get children() {
				var e = J();
				return e.firstChild.nextSibling, i(e, g, null), e;
			}
		}), null), i(w, t(l, {
			get when() {
				return m();
			},
			children: (n) => (() => {
				var o = $(), s = o.firstChild, u = s.firstChild.nextSibling;
				return u.nextSibling, i(s, () => n().rows.length, u), i(s, () => n().rows.length === 1 ? "" : "s", null), i(o, t(l, {
					get when() {
						return n().columns.length > 0;
					},
					get fallback() {
						return pe();
					},
					get children() {
						var o = fe(), s = o.firstChild.firstChild, l = s.firstChild, u = s.nextSibling;
						return i(l, t(c, {
							get each() {
								return n().columns;
							},
							children: (e) => (() => {
								var t = me();
								return i(t, e), t;
							})()
						})), i(u, t(c, {
							get each() {
								return n().rows;
							},
							children: (o, s) => (() => {
								var l = he();
								return i(l, t(c, {
									get each() {
										return n().columns;
									},
									children: (e) => (() => {
										var t = ge();
										return i(t, (() => {
											var t = a(() => o[e] === null);
											return () => t() ? _e() : String(o[e]);
										})()), t;
									})()
								})), r(() => e(l, s() % 2 == 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800")), l;
							})()
						})), o;
					}
				}), null), o;
			})()
		}), null), r(() => O.value = u()), n;
	})();
};
n([
	"click",
	"input",
	"keydown"
]);
//#endregion
//#region src/sync/DbStatusDropdown.tsx
var be = /* @__PURE__ */ s("<span class=\"text-green-500 text-xs font-bold\">✓"), xe = /* @__PURE__ */ s("<span class=\"text-green-500 text-sm\">✓"), Se = /* @__PURE__ */ s("<button type=button class=\"w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed\"><svg xmlns=http://www.w3.org/2000/svg class=\"w-4 h-4\"width=16 height=16 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"></path><polyline points=\"17 8 12 3 7 8\"></polyline><line x1=12 y1=3 x2=12 y2=15>"), Ce = /* @__PURE__ */ s("<div class=\"rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 space-y-2\"><p class=\"text-xs text-yellow-800 dark:text-yellow-300\"> delete operation(s) queued. Upload without deletions, or allow all?</p><div class=\"flex gap-2 flex-wrap\"><button type=button class=\"px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300\">Cancel</button><button type=button class=\"px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700\">Upload (no deletes)</button><button type=button class=\"px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700\">Allow deletes"), we = /* @__PURE__ */ s("<div class=\"px-4 py-2 border-t border-gray-200 dark:border-gray-700\">"), Te = /* @__PURE__ */ s("<div class=\"px-4 py-2 border-t border-gray-200 dark:border-gray-700\"><button type=button class=\"w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed\"><svg xmlns=http://www.w3.org/2000/svg class=\"w-4 h-4\"width=16 height=16 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"></path><polyline points=\"7 10 12 15 17 10\"></polyline><line x1=12 y1=15 x2=12 y2=3>"), Ee = /* @__PURE__ */ s("<div class=\"absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50\"><div class=py-2><div class=\"px-4 py-3 border-b border-gray-200 dark:border-gray-700\"><h3 class=\"text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3\">Database Status</h3><div class=space-y-2><div class=\"flex items-start gap-2\"><div class=flex-1><div class=\"text-sm font-medium text-gray-900 dark:text-gray-100\">Local Database</div><div class=\"text-xs text-gray-500 dark:text-gray-400\"></div></div></div><div class=\"flex items-start gap-2\"><div class=flex-1><div class=\"text-sm font-medium text-gray-900 dark:text-gray-100\"></div><div class=\"text-xs text-gray-500 dark:text-gray-400\"></div></div></div><div class=\"flex items-start gap-2\"><span></span><div class=flex-1><div class=\"text-sm font-medium text-gray-900 dark:text-gray-100\">Network</div><div class=\"text-xs text-gray-500 dark:text-gray-400\"></div></div></div></div></div><div class=\"px-4 py-2 border-t border-gray-200 dark:border-gray-700\"><a class=\"w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 rounded-md\"><svg xmlns=http://www.w3.org/2000/svg class=\"w-4 h-4\"width=16 height=16 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d=\"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z\"></path></svg>Database Browser"), De = /* @__PURE__ */ s("<div class=\"fixed inset-0 z-40\"aria-hidden=true>"), Oe = /* @__PURE__ */ s("<div class=relative><button type=button data-testid=db-status-trigger class=\"w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors\"aria-label=\"Database and sync status\"><svg xmlns=http://www.w3.org/2000/svg class=\"w-5 h-5 flex-shrink-0\"width=20 height=20 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><ellipse cx=12 cy=5 rx=9 ry=3></ellipse><path d=\"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5\"></path><path d=\"M3 12c0 1.66 4 3 9 3s9-1.34 9-3\"></path></svg><span data-testid=db-status-text class=\"flex-1 text-left\">"), ke = /* @__PURE__ */ s("<span class=\"text-yellow-500 text-xs\">⚠️"), Ae = /* @__PURE__ */ s("<span class=\"text-yellow-500 text-sm\">⏳"), je = /* @__PURE__ */ s("<span class=\"text-yellow-500 text-sm\">"), Me = /* @__PURE__ */ s("<div class=\"mt-1 text-xs text-gray-400 dark:text-gray-500\"><span class=\"font-medium text-gray-600 dark:text-gray-300\">Last Sync:</span> <!> (<!> ago, <!>)"), Ne = /* @__PURE__ */ s("<span class=\"ml-auto text-xs text-gray-400 dark:text-gray-500\">(Offline)");
function Pe(e) {
	let t = Date.now() - new Date(e).getTime(), n = Math.floor(t / 6e4);
	if (n < 1) return "just now";
	if (n === 1) return "1 min";
	if (n < 60) return `${n} mins`;
	let r = Math.floor(n / 60);
	return r === 1 ? "1 hour" : r < 24 ? `${r} hours` : `${Math.floor(r / 24)}d`;
}
var Fe = (n) => {
	let { localDb: s, isAnonymous: c, forceSyncDown: u, forceSyncUp: f, lastSyncTimestamp: h, lastSyncMode: g } = w(), [_, v] = p(typeof navigator < "u" ? navigator.onLine : !0), [y, b] = p(0), [x, S] = p(!1), [C, T] = p(!1), [E, D] = p(!1), [O, k] = p(0), [A, j] = p(!1);
	d(() => {
		let e = () => v(!0), t = () => v(!1);
		window.addEventListener("online", e), window.addEventListener("offline", t), m(() => {
			window.removeEventListener("online", e), window.removeEventListener("offline", t);
		});
	}), d(() => {
		let e = s?.();
		if (!e || c()) {
			b(0);
			return;
		}
		let t = async () => {
			try {
				let t = await e.all("SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress')");
				b(Number(t[0]?.count ?? 0));
			} catch {
				b(0);
			}
		};
		t();
		let n = setInterval(t, 5e3);
		m(() => clearInterval(n));
	});
	let M = () => c() ? "Local Only" : !_() && y() > 0 ? `Offline – ${y()} pending` : _() ? y() > 0 ? `Syncing ${y()}` : "Synced" : "Offline", N = async () => {
		let e = s?.();
		if (!e) return 0;
		try {
			let t = await e.all("SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress') AND lower(operation) = 'delete'");
			return Number(t[0]?.count ?? 0);
		} catch {
			return 0;
		}
	}, P = async (e) => {
		if (f) {
			T(!0);
			try {
				await f(e);
			} catch (e) {
				console.error("[DbStatusDropdown] Force sync up failed:", e);
			} finally {
				T(!1), S(!1);
			}
		}
	}, F = async () => {
		let e = await N();
		if (k(e), e > 0) {
			j(!0);
			return;
		}
		await P();
	}, I = async () => {
		if (u) {
			D(!0);
			try {
				await u({ full: !0 });
			} catch (e) {
				console.error("[DbStatusDropdown] Force sync down failed:", e);
			} finally {
				D(!1), S(!1);
			}
		}
	}, L = () => n.dbBrowserPath ?? "/debug/db";
	return (() => {
		var n = Oe(), d = n.firstChild, p = d.firstChild.nextSibling;
		return d.$$click = () => S(!x()), i(p, M), i(d, t(l, {
			get when() {
				return a(() => !!_())() && y() === 0;
			},
			get fallback() {
				return ke();
			},
			get children() {
				return be();
			}
		}), null), i(n, t(l, {
			get when() {
				return x();
			},
			get children() {
				return [(() => {
					var n = Ee(), d = n.firstChild, p = d.firstChild, m = p.firstChild.nextSibling.firstChild, v = m.firstChild, b = v.firstChild.nextSibling, x = m.nextSibling, w = x.firstChild, T = w.firstChild, D = T.nextSibling, k = x.nextSibling.firstChild, N = k.nextSibling.firstChild.nextSibling, R = p.nextSibling, z = R.firstChild;
					return i(m, t(l, {
						get when() {
							return s?.();
						},
						get fallback() {
							return Ae();
						},
						get children() {
							return xe();
						}
					}), v), i(b, () => s?.() ? "Initialized and ready" : "Initializing…"), i(x, t(l, {
						get when() {
							return a(() => !!_())() && y() === 0;
						},
						get fallback() {
							return (() => {
								var e = je();
								return i(e, () => _() ? "🔄" : "⚠️"), e;
							})();
						},
						get children() {
							return xe();
						}
					}), w), i(T, M), i(D, () => c() && "Data stored on this device only", null), i(D, () => !c() && !_() && "Changes will sync when reconnected", null), i(D, () => !c() && _() && y() === 0 && "All changes synced to Supabase", null), i(D, (() => {
						var e = a(() => !!(!c() && _() && y() > 0));
						return () => e() && `${y()} change${y() === 1 ? "" : "s"} syncing…`;
					})(), null), i(w, t(l, {
						get when() {
							return h?.();
						},
						children: (e) => (() => {
							var t = Me(), n = t.firstChild.nextSibling.nextSibling, r = n.nextSibling.nextSibling, a = r.nextSibling.nextSibling;
							return a.nextSibling, i(t, () => new Date(e()).toLocaleString(), n), i(t, () => Pe(e()), r), i(t, () => g?.() ?? "n/a", a), t;
						})()
					}), null), i(k, () => _() ? "🌐" : "📴"), i(N, () => _() ? "Online" : "Offline"), i(d, t(l, {
						when: f,
						get children() {
							var e = we();
							return i(e, t(l, {
								get when() {
									return !A();
								},
								get children() {
									var e = Se();
									return e.firstChild, e.$$click = F, i(e, () => C() ? "Uploading…" : "Force Sync Up", null), i(e, (() => {
										var e = a(() => !_());
										return () => e() && Ne();
									})(), null), r(() => e.disabled = !_() || C()), e;
								}
							}), null), i(e, t(l, {
								get when() {
									return A();
								},
								get children() {
									var e = Ce(), t = e.firstChild, n = t.firstChild, r = t.nextSibling.firstChild, a = r.nextSibling, o = a.nextSibling;
									return i(t, O, n), r.$$click = () => j(!1), a.$$click = () => {
										j(!1), P({ allowDeletes: !1 });
									}, o.$$click = () => {
										j(!1), P({ allowDeletes: !0 });
									}, e;
								}
							}), null), e;
						}
					}), R), i(d, t(l, {
						when: u,
						get children() {
							var e = Te(), t = e.firstChild;
							return t.firstChild, t.$$click = I, i(t, () => E() ? "Downloading…" : "Force Full Sync Down", null), i(t, (() => {
								var e = a(() => !_());
								return () => e() && Ne();
							})(), null), r(() => t.disabled = !_() || E()), e;
						}
					}), R), z.$$click = () => S(!1), r((t) => {
						var n = `text-sm ${_() ? "text-green-500" : "text-yellow-500"}`, r = L();
						return n !== t.e && e(k, t.e = n), r !== t.t && o(z, "href", t.t = r), t;
					}, {
						e: void 0,
						t: void 0
					}), n;
				})(), (() => {
					var e = De();
					return e.$$keydown = (e) => {
						e.key === "Escape" && S(!1);
					}, e.$$click = () => S(!1), e;
				})()];
			}
		}), null), r(() => o(d, "aria-expanded", x())), n;
	})();
};
n(["click", "keydown"]);
//#endregion
export { S as AuthContext, j as AuthPanel, C as AuthProvider, ye as DatabaseBrowser, Fe as DbStatusDropdown, V as LoginPage, U as ProtectedRoute, W as createSupabaseClient, w as useAuth };

//# sourceMappingURL=index.mjs.map