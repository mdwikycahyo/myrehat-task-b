function trimTrailingSlash(url: string) {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * A browser can only reach hosts with a public-looking name. A single-label
 * name such as `server` is a Docker service name that only resolves inside the
 * compose network.
 */
function isBrowserReachable(url: string) {
	try {
		const { hostname } = new URL(url);
		return (
			hostname === "localhost" ||
			hostname.includes(".") ||
			hostname.includes(":")
		);
	} catch {
		return false;
	}
}

/**
 * Base URL for calls to the API server (`/rpc`, `/api/auth`).
 *
 * - Server side: prefer `SERVER_URL` (Docker-internal, e.g. `http://server:3000`).
 * - Browser: use the configured URL when a browser can reach it (local dev:
 *   `http://localhost:3000`). Otherwise, e.g. when the build baked in the
 *   compose default `http://server:3000`, use the page's own origin;
 *   `next.config.ts` rewrites `/rpc` and `/api/auth` from there to the server.
 */
export function resolveServerUrl(
	configuredUrl: string | undefined,
	runtime: { serverUrl?: string; browserOrigin?: string },
): string {
	if (runtime.browserOrigin === undefined) {
		return trimTrailingSlash(runtime.serverUrl || configuredUrl || "");
	}
	if (configuredUrl && isBrowserReachable(configuredUrl)) {
		return trimTrailingSlash(configuredUrl);
	}
	return trimTrailingSlash(runtime.browserOrigin);
}

export function getServerUrl(): string {
	const isBrowser = typeof window !== "undefined";
	return resolveServerUrl(process.env.NEXT_PUBLIC_SERVER_URL, {
		serverUrl:
			!isBrowser && typeof process !== "undefined"
				? process.env.SERVER_URL
				: undefined,
		browserOrigin: isBrowser ? window.location.origin : undefined,
	});
}
