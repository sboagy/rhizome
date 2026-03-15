import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [solid(), dts({ rollupTypes: true })],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			formats: ["es", "cjs"],
			fileName: (format) => `index.${format === "es" ? "mjs" : "js"}`,
		},
		rollupOptions: {
			// Solid-js and supabase are peer deps — don't bundle them
			external: ["solid-js", "@supabase/supabase-js", /^solid-js\//],
		},
	},
});
