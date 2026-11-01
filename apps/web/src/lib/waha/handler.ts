import type { LanguageModel } from "ai";
import { CONCIERGE_FALLBACK_REPLY, generateConciergeReply } from "./concierge";
import { buildReply, classifyWebhook } from "./contract";

export type WahaWebhookDeps = {
	/** Called per request; returns undefined when no model is configured. */
	getModel: () => LanguageModel | undefined;
	timeoutMs?: number;
};

export async function handleWahaWebhook(
	request: Request,
	deps: WahaWebhookDeps,
): Promise<Response> {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ error: "invalid_json" }, { status: 400 });
	}

	const result = classifyWebhook(json);
	if (result.kind === "invalid") {
		return Response.json(
			{ error: "invalid_payload", issues: result.issues },
			{ status: 400 },
		);
	}
	if (result.kind === "ignored") {
		return Response.json({ ignored: true, reason: result.reason });
	}

	const model = deps.getModel();
	if (!model) {
		console.warn(
			"waha: OPENROUTER_API_KEY is not set; returning fallback reply",
		);
		return Response.json(buildReply(result.to, CONCIERGE_FALLBACK_REPLY));
	}
	const reply = await generateConciergeReply(result.text, {
		model,
		timeoutMs: deps.timeoutMs,
	});
	return Response.json(buildReply(result.to, reply));
}
