import { ENV } from "../../../../env";
import { createOpenRouterModel } from "../../../../lib/waha/concierge";
import { handleWahaWebhook } from "../../../../lib/waha/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
	return handleWahaWebhook(request, {
		// Read at request time: sensitive varlock items are never inlined at build.
		getModel: () => {
			const apiKey = ENV.OPENROUTER_API_KEY;
			if (!apiKey) return undefined;
			return createOpenRouterModel(
				apiKey,
				ENV.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
			);
		},
	});
}
