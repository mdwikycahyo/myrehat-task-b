import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "./server-url";

describe("resolveServerUrl", () => {
	describe("on the server (SSR)", () => {
		it("prefers SERVER_URL over the public URL", () => {
			expect(
				resolveServerUrl("https://app.example.com", {
					serverUrl: "http://server:3000/",
				}),
			).toBe("http://server:3000");
		});

		it("falls back to the configured URL without SERVER_URL (local dev)", () => {
			expect(resolveServerUrl("http://localhost:3000/", {})).toBe(
				"http://localhost:3000",
			);
		});
	});

	describe("in the browser", () => {
		const browserOrigin = "https://app.example.com";

		it("uses the page origin when the build baked in a Docker service name", () => {
			expect(
				resolveServerUrl("http://server:3000", {
					browserOrigin,
					serverUrl: "http://server:3000",
				}),
			).toBe(browserOrigin);
		});

		it("uses the page origin when no URL is configured or it is invalid", () => {
			expect(resolveServerUrl(undefined, { browserOrigin })).toBe(
				browserOrigin,
			);
			expect(resolveServerUrl("", { browserOrigin })).toBe(browserOrigin);
			expect(resolveServerUrl("not a url", { browserOrigin })).toBe(
				browserOrigin,
			);
		});

		it("keeps a reachable configured URL", () => {
			expect(
				resolveServerUrl("http://localhost:3000", {
					browserOrigin: "http://localhost:3001",
				}),
			).toBe("http://localhost:3000");
			expect(
				resolveServerUrl("https://app.example.com/", { browserOrigin }),
			).toBe("https://app.example.com");
			expect(resolveServerUrl("http://127.0.0.1:3000", { browserOrigin })).toBe(
				"http://127.0.0.1:3000",
			);
		});
	});
});
