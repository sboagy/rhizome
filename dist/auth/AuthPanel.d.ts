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
export default function AuthPanel(props: AuthPanelProps): import("solid-js").JSX.Element;
export {};
//# sourceMappingURL=AuthPanel.d.ts.map