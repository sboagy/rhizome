/**
 * DbStatusDropdown — Shared database/sync status dropdown.
 *
 * Shows local DB initialization state, sync status, network status, and
 * provides Force Sync Up / Force Full Sync Down actions plus a link to
 * the SQLite WASM Database Browser.
 *
 * Consumes localDb, forceSyncDown, forceSyncUp, lastSyncTimestamp, and
 * lastSyncMode from the auth context, which the consumer populates via
 * AuthProvider's syncState prop (e.g., from CubeAuthProvider).
 *
 * Usage:
 *   import { DbStatusDropdown } from "@rhizome/core";
 *   <DbStatusDropdown dbBrowserPath="/debug/db" />
 */
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useAuth } from "../auth/useAuth";

export interface DbStatusDropdownProps {
	/** Route path for the SQLite database browser page. Defaults to "/debug/db". */
	dbBrowserPath?: string;
}

/** Format an ISO timestamp as a concise relative time string. */
function formatRelativeTime(isoTimestamp: string): string {
	const diffMs = Date.now() - new Date(isoTimestamp).getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "just now";
	if (diffMins === 1) return "1 min";
	if (diffMins < 60) return `${diffMins} mins`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours === 1) return "1 hour";
	if (diffHours < 24) return `${diffHours} hours`;
	return `${Math.floor(diffHours / 24)}d`;
}

export const DbStatusDropdown: Component<DbStatusDropdownProps> = (props) => {
	const {
		localDb,
		isAnonymous,
		forceSyncDown,
		forceSyncUp,
		lastSyncTimestamp,
		lastSyncMode,
	} = useAuth();

	const [isOnline, setIsOnline] = createSignal(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const [pendingCount, setPendingCount] = createSignal(0);
	const [showMenu, setShowMenu] = createSignal(false);
	const [syncUpBusy, setSyncUpBusy] = createSignal(false);
	const [syncDownBusy, setSyncDownBusy] = createSignal(false);
	// Used when pending deletes are detected — show inline confirmation.
	const [pendingDeleteCount, setPendingDeleteCount] = createSignal(0);
	const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

	// Online / offline detection
	createEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		onCleanup(() => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		});
	});

	// Poll outbox pending count every 5 s (skip for anonymous users; DB may not have sync tables)
	createEffect(() => {
		const db = localDb?.();
		if (!db || isAnonymous()) {
			setPendingCount(0);
			return;
		}
		const updateCount = async () => {
			try {
				const rows = await db.all<{ count: number }>(
					"SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress')",
				);
				setPendingCount(Number(rows[0]?.count ?? 0));
			} catch {
				// sync_push_queue may not exist for anonymous or freshly-initialized DBs
				setPendingCount(0);
			}
		};
		updateCount();
		const interval = setInterval(updateCount, 5_000);
		onCleanup(() => clearInterval(interval));
	});

	const statusText = () => {
		if (isAnonymous()) return "Local Only";
		if (!isOnline() && pendingCount() > 0)
			return `Offline – ${pendingCount()} pending`;
		if (!isOnline()) return "Offline";
		if (pendingCount() > 0) return `Syncing ${pendingCount()}`;
		return "Synced";
	};

	const getPendingDeleteCount = async (): Promise<number> => {
		const db = localDb?.();
		if (!db) return 0;
		try {
			const rows = await db.all<{ count: number }>(
				"SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress') AND lower(operation) = 'delete'",
			);
			return Number(rows[0]?.count ?? 0);
		} catch {
			return 0;
		}
	};

	const runForceSyncUp = async (opts?: { allowDeletes?: boolean }) => {
		if (!forceSyncUp) return;
		setSyncUpBusy(true);
		try {
			await forceSyncUp(opts);
		} catch (err) {
			console.error("[DbStatusDropdown] Force sync up failed:", err);
		} finally {
			setSyncUpBusy(false);
			setShowMenu(false);
		}
	};

	const handleForceSyncUpClick = async () => {
		const deletes = await getPendingDeleteCount();
		setPendingDeleteCount(deletes);
		if (deletes > 0) {
			setShowDeleteConfirm(true);
			return;
		}
		await runForceSyncUp();
	};

	const handleForceSyncDown = async () => {
		if (!forceSyncDown) return;
		setSyncDownBusy(true);
		try {
			await forceSyncDown({ full: true });
		} catch (err) {
			console.error("[DbStatusDropdown] Force sync down failed:", err);
		} finally {
			setSyncDownBusy(false);
			setShowMenu(false);
		}
	};

	const browserPath = () => props.dbBrowserPath ?? "/debug/db";

	return (
		<div class="relative">
			{/* Trigger button */}
			<button
				type="button"
				data-testid="db-status-trigger"
				onClick={() => setShowMenu(!showMenu())}
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
				aria-label="Database and sync status"
				aria-expanded={showMenu()}
			>
				{/* Database icon */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-5 h-5 flex-shrink-0"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<ellipse cx="12" cy="5" rx="9" ry="3" />
					<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
					<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
				</svg>
				<span data-testid="db-status-text" class="flex-1 text-left">{statusText()}</span>
				{/* Status badge */}
				<Show
					when={isOnline() && pendingCount() === 0}
					fallback={<span class="text-yellow-500 text-xs">⚠️</span>}
				>
					<span class="text-green-500 text-xs font-bold">✓</span>
				</Show>
			</button>

			{/* Dropdown panel — opens upward from current position */}
			<Show when={showMenu()}>
				<div class="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
					<div class="py-2">
						{/* Database Status */}
						<div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
							<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
								Database Status
							</h3>
							<div class="space-y-2">
								{/* Local DB row */}
								<div class="flex items-start gap-2">
									<Show
										when={localDb?.()}
										fallback={
											<span class="text-yellow-500 text-sm">⏳</span>
										}
									>
										<span class="text-green-500 text-sm">✓</span>
									</Show>
									<div class="flex-1">
										<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
											Local Database
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{localDb?.()
												? "Initialized and ready"
												: "Initializing…"}
										</div>
									</div>
								</div>

								{/* Sync status row */}
								<div class="flex items-start gap-2">
									<Show
										when={isOnline() && pendingCount() === 0}
										fallback={
											<span class="text-yellow-500 text-sm">
												{isOnline() ? "🔄" : "⚠️"}
											</span>
										}
									>
										<span class="text-green-500 text-sm">✓</span>
									</Show>
									<div class="flex-1">
										<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
											{statusText()}
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{isAnonymous() && "Data stored on this device only"}
											{!isAnonymous() &&
												!isOnline() &&
												"Changes will sync when reconnected"}
											{!isAnonymous() &&
												isOnline() &&
												pendingCount() === 0 &&
												"All changes synced to Supabase"}
											{!isAnonymous() &&
												isOnline() &&
												pendingCount() > 0 &&
												`${pendingCount()} change${pendingCount() === 1 ? "" : "s"} syncing…`}
										</div>
										<Show when={lastSyncTimestamp?.()}>
											{(ts) => (
												<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
													<span class="font-medium text-gray-600 dark:text-gray-300">
														Last Sync:
													</span>{" "}
													{new Date(ts()).toLocaleString()} (
													{formatRelativeTime(ts())} ago,{" "}
													{lastSyncMode?.() ?? "n/a"})
												</div>
											)}
										</Show>
									</div>
								</div>

								{/* Network row */}
								<div class="flex items-start gap-2">
									<span
										class={`text-sm ${isOnline() ? "text-green-500" : "text-yellow-500"}`}
									>
										{isOnline() ? "🌐" : "📴"}
									</span>
									<div class="flex-1">
										<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
											Network
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{isOnline() ? "Online" : "Offline"}
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Force Sync Up (only when sync is wired up) */}
						<Show when={forceSyncUp}>
							<div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
								{/* Normal sync-up button */}
								<Show when={!showDeleteConfirm()}>
									<button
										type="button"
										onClick={handleForceSyncUpClick}
										disabled={!isOnline() || syncUpBusy()}
										class="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="w-4 h-4"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
											<polyline points="17 8 12 3 7 8" />
											<line x1="12" y1="3" x2="12" y2="15" />
										</svg>
										{syncUpBusy() ? "Uploading…" : "Force Sync Up"}
										{!isOnline() && (
											<span class="ml-auto text-xs text-gray-400 dark:text-gray-500">
												(Offline)
											</span>
										)}
									</button>
								</Show>

								{/* Inline delete-confirmation panel */}
								<Show when={showDeleteConfirm()}>
									<div class="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 space-y-2">
										<p class="text-xs text-yellow-800 dark:text-yellow-300">
											{pendingDeleteCount()} delete operation(s) queued. Upload
											without deletions, or allow all?
										</p>
										<div class="flex gap-2 flex-wrap">
											<button
												type="button"
												onClick={() => setShowDeleteConfirm(false)}
												class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
											>
												Cancel
											</button>
											<button
												type="button"
												onClick={() => {
													setShowDeleteConfirm(false);
													runForceSyncUp({ allowDeletes: false });
												}}
												class="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
											>
												Upload (no deletes)
											</button>
											<button
												type="button"
												onClick={() => {
													setShowDeleteConfirm(false);
													runForceSyncUp({ allowDeletes: true });
												}}
												class="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
											>
												Allow deletes
											</button>
										</div>
									</div>
								</Show>
							</div>
						</Show>

						{/* Force Sync Down (only when sync is wired up) */}
						<Show when={forceSyncDown}>
							<div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
								<button
									type="button"
									onClick={handleForceSyncDown}
									disabled={!isOnline() || syncDownBusy()}
									class="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="w-4 h-4"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
										<polyline points="7 10 12 15 17 10" />
										<line x1="12" y1="15" x2="12" y2="3" />
									</svg>
									{syncDownBusy() ? "Downloading…" : "Force Full Sync Down"}
									{!isOnline() && (
										<span class="ml-auto text-xs text-gray-400 dark:text-gray-500">
											(Offline)
										</span>
									)}
								</button>
							</div>
						</Show>

						{/* Database Browser link */}
						<div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
							<a
								href={browserPath()}
								class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 rounded-md"
								onClick={() => setShowMenu(false)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="w-4 h-4"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
								Database Browser
							</a>
						</div>
					</div>
				</div>

				{/* Click-outside overlay */}
				<div
					class="fixed inset-0 z-40"
					onClick={() => setShowMenu(false)}
					onKeyDown={(e) => {
						if (e.key === "Escape") setShowMenu(false);
					}}
					aria-hidden="true"
				/>
			</Show>
		</div>
	);
};
