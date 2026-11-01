import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONCIERGE_FALLBACK_REPLY } from "../../../../lib/waha/concierge";
import { handleWahaWebhook } from "../../../../lib/waha/handler";

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function modelReturning(text: string) {
	return new MockLanguageModelV4({
		doGenerate: async () => ({
			content: [{ type: "text", text }],
			finishReason: { unified: "stop", raw: "stop" },
			usage,
			warnings: [],
		}),
	});
}

function post(body: string) {
	return new Request("http://localhost/api/webhooks/waha", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});
}

const validBody = {
	event: "message",
	payload: { from: "6281234567890@c.us", body: "Halo, ada homestay di Ubud?" },
};

afterEach(() => vi.restoreAllMocks());

describe("handleWahaWebhook", () => {
	it("returns 400 invalid_json for malformed JSON", async () => {
		const res = await handleWahaWebhook(post("{nope"), {
			getModel: () => modelReturning("x"),
		});
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_json" });
	});

	it("returns 400 invalid_payload with issues for a bad payload", async () => {
		const res = await handleWahaWebhook(
			post(
				JSON.stringify({
					event: "message",
					payload: { from: "x@g.us", body: "" },
				}),
			),
			{ getModel: () => modelReturning("x") },
		);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("invalid_payload");
		expect(Array.isArray(json.issues)).toBe(true);
		expect(json.issues.length).toBeGreaterThan(0);
	});

	it("returns 200 ignored for non-message events without calling the model", async () => {
		const model = modelReturning("x");
		const res = await handleWahaWebhook(
			post(JSON.stringify({ ...validBody, event: "session.status" })),
			{ getModel: () => model },
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.ignored).toBe(true);
		expect(typeof json.reason).toBe("string");
		expect(model.doGenerateCalls).toHaveLength(0);
	});

	it("ignores messages sent by the bot itself (fromMe)", async () => {
		const res = await handleWahaWebhook(
			post(
				JSON.stringify({
					...validBody,
					payload: { ...validBody.payload, fromMe: true },
				}),
			),
			{ getModel: () => modelReturning("x") },
		);
		expect(res.status).toBe(200);
		expect((await res.json()).ignored).toBe(true);
	});

	it("replies with exactly { to, reply } for a valid message", async () => {
		const model = modelReturning("Halo! Cek /listings ya.");
		const res = await handleWahaWebhook(post(JSON.stringify(validBody)), {
			getModel: () => model,
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(Object.keys(json)).toEqual(["to", "reply"]);
		expect(json.to).toBe(validBody.payload.from);
		expect(json.reply).toBe("Halo! Cek /listings ya.");
		expect(model.doGenerateCalls).toHaveLength(1);
	});

	it("preserves the sender id exactly", async () => {
		const from = "6281234567890@s.whatsapp.net";
		const res = await handleWahaWebhook(
			post(JSON.stringify({ ...validBody, payload: { from, body: "Hi" } })),
			{ getModel: () => modelReturning("Hello") },
		);
		expect((await res.json()).to).toBe(from);
	});

	it("returns 200 with the fallback reply when the model throws", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new Error("429 sk-or-secret");
			},
		});
		const res = await handleWahaWebhook(post(JSON.stringify(validBody)), {
			getModel: () => model,
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(Object.keys(json)).toEqual(["to", "reply"]);
		expect(json.to).toBe(validBody.payload.from);
		expect(json.reply).toBe(CONCIERGE_FALLBACK_REPLY);
	});

	it("returns the fallback and warns safely when no model is configured", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const res = await handleWahaWebhook(post(JSON.stringify(validBody)), {
			getModel: () => undefined,
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(Object.keys(json)).toEqual(["to", "reply"]);
		expect(json.to).toBe(validBody.payload.from);
		expect(json.reply).toBe(CONCIERGE_FALLBACK_REPLY);
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
