import { z } from "zod";

/** 8–15 digits, optionally suffixed with @c.us or @s.whatsapp.net. Groups (@g.us) are rejected. */
const WHATSAPP_CHAT_ID = /^\d{8,15}(?:@c\.us|@s\.whatsapp\.net)?$/;

export const wahaWebhookSchema = z.object({
	event: z.string().min(1),
	payload: z.object({
		from: z.string().regex(WHATSAPP_CHAT_ID),
		body: z.string().trim().min(1).max(4000),
		fromMe: z.boolean().optional(),
	}),
});

export type WahaWebhook = z.infer<typeof wahaWebhookSchema>;

export type WahaWebhookClassification =
	| { kind: "invalid"; issues: z.core.$ZodIssue[] }
	| { kind: "ignored"; reason: string }
	| { kind: "message"; to: string; text: string };

export function classifyWebhook(json: unknown): WahaWebhookClassification {
	const parsed = wahaWebhookSchema.safeParse(json);
	if (!parsed.success) {
		return { kind: "invalid", issues: parsed.error.issues };
	}
	const { event, payload } = parsed.data;
	if (event !== "message") {
		return { kind: "ignored", reason: `unsupported event: ${event}` };
	}
	if (payload.fromMe === true) {
		return { kind: "ignored", reason: "message sent by this account" };
	}
	return { kind: "message", to: payload.from, text: payload.body };
}

export type WahaReply = { to: string; reply: string };

export function buildReply(to: string, reply: string): WahaReply {
	return { to, reply };
}
