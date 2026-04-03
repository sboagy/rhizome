import { Component } from 'solid-js';
export interface DatabaseBrowserProps {
    /**
     * App-specific preset SQL queries shown after the built-in sync queue presets.
     */
    presetQueries?: Array<{
        name: string;
        sql: string;
    }>;
}
export declare const DatabaseBrowser: Component<DatabaseBrowserProps>;
//# sourceMappingURL=DatabaseBrowser.d.ts.map