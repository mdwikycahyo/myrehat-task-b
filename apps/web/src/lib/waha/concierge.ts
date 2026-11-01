import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";

export const CONCIERGE_FALLBACK_REPLY =
	"Maaf, saya sedang tidak bisa menjawab saat ini. Silakan lihat daftar properti kami di /listings atau coba lagi sebentar lagi. / Sorry, I can't reply right now. Please browse our listings at /listings or try again shortly.";

export const CONCIERGE_SYSTEM_PROMPT = `You are the WhatsApp concierge for a platform where travellers book homestays directly with hosts (direct-host booking), and where people can also buy property, land for a homestay, and Airbnb listings or businesses.
Reply in the customer's language: Indonesian or English.
Keep replies short, in plain text suitable for WhatsApp, with no markdown.
Never invent specific listings, prices or availability. Instead, point the customer to the listings page at /listings.`;

const DEFAULT_TIMEOUT_MS = 20_000;

export type ConciergeDeps = {
	model: LanguageModel;
	timeoutMs?: number;
};

export function createOpenRouterModel(
	apiKey: string,
	modelId: string,
): LanguageModel {
	return createOpenRouter({ apiKey }).chat(modelId);
}

export async function generateConciergeReply(
	text: string,
	deps: ConciergeDeps,
): Promise<string> {
	try {
		const result = await generateText({
			model: deps.model,
			system: CONCIERGE_SYSTEM_PROMPT,
			prompt: text,
			maxOutputTokens: 300,
			abortSignal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
		});
		const reply = result.text.trim();
		if (!reply) {
			console.error("concierge: model returned empty text");
			return CONCIERGE_FALLBACK_REPLY;
		}
		return reply;
	} catch {
		// Fixed diagnostic only: error names/messages are untrusted and may contain credentials.
		console.error("concierge: generation failed; returning fallback reply");
		return CONCIERGE_FALLBACK_REPLY;
	}
}
