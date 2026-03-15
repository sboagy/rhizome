/**
 * DatabaseBrowser — Shared SQLite WASM Database Browser page.
 *
 * Full-page SQL query interface for inspecting the local SQLite WASM database.
 * Uses localDb from the auth context (provided by the sync worker via syncState).
 *
 * Usage:
 *   import { DatabaseBrowser } from "@rhizome/core";
 *   // Mount at a protected route, e.g.
 *   <Route path="/debug/db" component={() =>
 *     <ProtectedRoute><DatabaseBrowser /></ProtectedRoute>
 *   } />
 *
 * Consumer apps can inject additional preset queries via props:
 *   <DatabaseBrowser presetQueries={[
 *     { name: "All Algorithms", sql: "SELECT * FROM algorithm LIMIT 100;" },
 *   ]} />
 */
import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import { useAuth } from "../auth/useAuth";

export interface DatabaseBrowserProps {
	/**
	 * App-specific preset SQL queries shown after the built-in sync queue presets.
	 */
	presetQueries?: Array<{ name: string; sql: string }>;
}

interface QueryResult {
	columns: string[];
	rows: Array<Record<string, unknown>>;
}

/** Built-in presets that work for any oosync-based app. */
const DEFAULT_PRESETS: Array<{ name: string; sql: string }> = [
	{
		name: "List Tables",
		sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
	},
	{
		name: "Sync Queue (All)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at, last_error FROM sync_push_queue ORDER BY changed_at DESC LIMIT 50;",
	},
	{
		name: "Sync Queue (Pending)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at FROM sync_push_queue WHERE status = 'pending' ORDER BY changed_at;",
	},
	{
		name: "Sync Queue (Failed)",
		sql: "SELECT id, table_name, row_id, operation, status, attempts, last_error, changed_at FROM sync_push_queue WHERE status = 'failed' ORDER BY changed_at DESC;",
	},
];

export const DatabaseBrowser: Component<DatabaseBrowserProps> = (props) => {
	const { localDb } = useAuth();

	const [query, setQuery] = createSignal(
		"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
	);
	const [results, setResults] = createSignal<QueryResult | null>(null);
	const [queryError, setQueryError] = createSignal<string | null>(null);
	const [executionTimeMs, setExecutionTimeMs] = createSignal(0);
	const [actionStatus, setActionStatus] = createSignal<string | null>(null);

	// Reactive table list — re-fetches whenever localDb changes
	const [tables] = createResource(localDb, async (db) => {
		if (!db) return [];
		const rows = await db.all<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
		);
		return rows.map((r) => r.name);
	});

	const allPresets = () => [...DEFAULT_PRESETS, ...(props.presetQueries ?? [])];

	const executeQuery = async () => {
		setQueryError(null);
		setResults(null);
		setActionStatus(null);
		const db = localDb?.();
		if (!db) {
			setQueryError("Database not initialized. Please sign in first.");
			return;
		}
		try {
			const t0 = performance.now();
			const rows = await db.all<Record<string, unknown>>(query());
			setExecutionTimeMs(performance.now() - t0);
			if (rows.length === 0) {
				setResults({ columns: [], rows: [] });
				return;
			}
			setResults({ columns: Object.keys(rows[0]), rows });
		} catch (err) {
			setQueryError(err instanceof Error ? err.message : String(err));
		}
	};

	const browseTable = (tableName: string) => {
		setQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
		// Small timeout lets the textarea re-render before the query fires.
		setTimeout(() => executeQuery(), 0);
	};

	const retryFailedSyncItems = async () => {
		setActionStatus(null);
		const db = localDb?.();
		if (!db) {
			setActionStatus("Database not initialized.");
			return;
		}
		try {
			// Run the update via all() — UPDATE returns no rows but executes fine.
			await db.all(
				"UPDATE sync_push_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'failed'",
			);
			setActionStatus("Reset failed sync items for retry.");
			// Refresh results if we're currently looking at the sync queue.
			if (query().toLowerCase().includes("sync_push_queue")) {
				executeQuery();
			}
		} catch (err) {
			setActionStatus(
				`Error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	return (
		<div class="fixed inset-0 flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
			{/* Header */}
			<div class="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
				<h1 class="text-2xl font-bold">SQLite WASM Database Browser</h1>
				<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
					💡 Each browser tab has its own database copy. After making changes
					elsewhere,{" "}
					<button
						type="button"
						onClick={() => window.location.reload()}
						class="text-blue-600 dark:text-blue-400 hover:underline"
					>
						refresh this page
					</button>{" "}
					to see the latest data from IndexedDB.
				</p>
			</div>

			{/* Body */}
			<div class="flex-1 flex overflow-hidden">
				{/* Left panel: tables + presets */}
				<div class="w-64 flex flex-col gap-4 p-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
					{/* Tables */}
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
							Tables
						</h2>
						<Show
							when={!tables.loading}
							fallback={
								<p class="text-sm text-gray-400">Loading…</p>
							}
						>
							<div class="space-y-0.5">
								<For each={tables()}>
									{(tbl) => (
										<button
											type="button"
											onClick={() => browseTable(tbl)}
											class="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
										>
											📋 {tbl}
										</button>
									)}
								</For>
							</div>
						</Show>
					</div>

					{/* Preset queries */}
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex-1">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
							Preset Queries
						</h2>
						<div class="space-y-0.5">
							<For each={allPresets()}>
								{(preset) => (
									<button
										type="button"
										onClick={() => setQuery(preset.sql)}
										class="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
									>
										⚡ {preset.name}
									</button>
								)}
							</For>
						</div>

						{/* Sync actions */}
						<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
							<button
								type="button"
								onClick={retryFailedSyncItems}
								class="w-full px-3 py-2 text-sm rounded bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-300 font-medium transition-colors"
							>
								🔄 Retry Failed Sync Items
							</button>
							<Show when={actionStatus()}>
								<p class="text-xs text-gray-500 dark:text-gray-400 break-words">
									{actionStatus()}
								</p>
							</Show>
						</div>
					</div>
				</div>

				{/* Right panel: query editor + results */}
				<div class="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
					{/* Query editor */}
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex-shrink-0">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
							SQL Query
						</h2>
						<textarea
							value={query()}
							onInput={(e) => setQuery(e.currentTarget.value)}
							onKeyDown={(e) => {
								if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
									e.preventDefault();
									executeQuery();
								}
							}}
							class="w-full h-28 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter SQL query…"
							spellcheck={false}
						/>
						<div class="mt-2 flex items-center gap-3">
							<button
								type="button"
								onClick={executeQuery}
								class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
							>
								▶ Execute
							</button>
							<Show when={results() && executionTimeMs() > 0}>
								<span class="text-xs text-gray-400 dark:text-gray-500">
									{executionTimeMs().toFixed(2)}ms
								</span>
							</Show>
							<span class="ml-auto text-xs text-gray-400 dark:text-gray-500">
								Ctrl+Enter to run
							</span>
						</div>
					</div>

					{/* Error */}
					<Show when={queryError()}>
						<div class="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300">
							<strong>Error:</strong> {queryError()}
						</div>
					</Show>

					{/* Results */}
					<Show when={results()}>
						{(res) => (
							<div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
								<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
									Results — {res().rows.length} row
									{res().rows.length !== 1 ? "s" : ""}
								</h2>
								<Show
									when={res().columns.length > 0}
									fallback={
										<p class="text-sm text-gray-500 dark:text-gray-400">
											Query executed successfully (no rows returned).
										</p>
									}
								>
									<div class="overflow-auto">
										<table class="w-full text-xs border-collapse">
											<thead>
												<tr class="bg-gray-200 dark:bg-gray-700 sticky top-0">
													<For each={res().columns}>
														{(col) => (
															<th class="text-left p-2 border border-gray-300 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
																{col}
															</th>
														)}
													</For>
												</tr>
											</thead>
											<tbody>
												<For each={res().rows}>
													{(row, i) => (
														<tr
															class={
																i() % 2 === 0
																	? "bg-white dark:bg-gray-900"
																	: "bg-gray-50 dark:bg-gray-850"
															}
														>
															<For each={res().columns}>
																{(col) => (
																	<td class="p-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 max-w-xs truncate">
																		{row[col] === null ? (
																			<span class="text-gray-400 italic">
																				NULL
																			</span>
																		) : (
																			String(row[col])
																		)}
																	</td>
																)}
															</For>
														</tr>
													)}
												</For>
											</tbody>
										</table>
									</div>
								</Show>
							</div>
						)}
					</Show>
				</div>
			</div>
		</div>
	);
};
