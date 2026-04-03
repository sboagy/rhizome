import { Component, JSX } from 'solid-js';
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
declare const LoginPage: Component<LoginPageProps>;
export default LoginPage;
//# sourceMappingURL=LoginPage.d.ts.map