import { useContext } from "solid-js";
import { AuthContext } from "./AuthProvider";
import type { AuthContextValue } from "./types";

/**
 * Returns the current auth context value.
 * Must be called inside a component tree wrapped by `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth() must be called inside <AuthProvider>");
	}
	return ctx;
}
