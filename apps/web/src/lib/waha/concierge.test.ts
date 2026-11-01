import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import {
	CONCIERGE_FALLBACK_REPLY,
	CONCIERGE_SYSTEM_PROMPT,
	generateConciergeReply,
} from "./concierge";

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

describe("generateConciergeReply", () => {
	it("returns the model text trimmed", async () => {
		const reply = await generateConciergeReply("Halo", {
			model: modelReturning("  Halo! Silakan cek /listings.\n"),
		});
		expect(reply).toBe("Halo! Silakan cek /listings.");
	});

	it("sends the system prompt, user text and token cap to the model", async () => {
		const model = modelReturning("ok");
		await generateConciergeReply("Ada homestay di Ubud?", { model });

		expect(model.doGenerateCalls).toHaveLength(1);
		const call = model.doGenerateCalls[0];
		const system = call.prompt.find((m) => m.role === "system");
		expect(system?.content).toBe(CONCIERGE_SYSTEM_PROMPT);
		expect(CONCIERGE_SYSTEM_PROMPT).toContain("/listings");
		const user = call.prompt.find((m) => m.role === "user");
		expect(JSON.stringify(user?.content)).toContain("Ada homestay di Ubud?");
		expect(call.maxOutputTokens).toBe(300);
		expect(call.abortSignal).toBeInstanceOf(AbortSignal);
	});

	it("returns the fallback and logs when the model throws", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new Error("429 Too Many Requests");
			},
		});
		const reply = await generateConciergeReply("Halo", { model });
		expect(reply).toBe(CONCIERGE_FALLBACK_REPLY);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("never logs the error message, which may contain an API key", async () => {
		const sentinel = "sk-or-v1-SENTINEL-SECRET-KEY";
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new Error(`401 invalid key ${sentinel}`);
			},
		});
		const reply = await generateConciergeReply("Halo", { model });
		expect(reply).toBe(CONCIERGE_FALLBACK_REPLY);
		expect(spy).toHaveBeenCalled();
		expect(JSON.stringify(spy.mock.calls)).not.toContain(sentinel);
		spy.mockRestore();
	});

	it("returns the fallback on timeout", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const model = new MockLanguageModelV4({
			doGenerate: ({ abortSignal }) =>
				new Promise((_, reject) => {
					abortSignal?.addEventListener("abort", () =>
						reject(abortSignal.reason),
					);
				}),
		});
		const reply = await generateConciergeReply("Halo", {
			model,
			timeoutMs: 20,
		});
		expect(reply).toBe(CONCIERGE_FALLBACK_REPLY);
		spy.mockRestore();
	});

	it("returns the fallback for empty or whitespace-only text", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		for (const text of ["", "   \n"]) {
			const reply = await generateConciergeReply("Halo", {
				model: modelReturning(text),
			});
			expect(reply).toBe(CONCIERGE_FALLBACK_REPLY);
		}
		spy.mockRestore();
	});
});
