import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [
		solid(),
		// API Extractor-backed type rollup currently misbundles this package under
		// TypeScript 6, but plain declaration emit is correct and publishable.
		dts({ rollupTypes: false }),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			formats: ["es", "cjs"],
			fileName: (format) => `index.${format === "es" ? "mjs" : "js"}`,
		},
		sourcemap: true,
		rollupOptions: {
			// Peer deps — must NOT be bundled or each consumer gets a separate
			// instance, which breaks context-based APIs like the SolidJS router.
			external: [
				"solid-js",
				/^solid-js\//,
				"@solidjs/router",
				/^@solidjs\//,
				"@supabase/supabase-js",
				/^@supabase\//,
			],
		},
	},
});
