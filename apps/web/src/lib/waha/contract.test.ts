import { describe, expect, it } from "vitest";
import { buildReply, classifyWebhook } from "./contract";

const valid = {
	event: "message",
	payload: { from: "6281234567890@c.us", body: "Halo, ada homestay di Ubud?" },
};

const withPayload = (payload: unknown, event: unknown = "message") => ({
	event,
	payload,
});

describe("classifyWebhook", () => {
	it("accepts a valid message and preserves from as to", () => {
		expect(classifyWebhook(valid)).toEqual({
			kind: "message",
			to: "6281234567890@c.us",
			text: "Halo, ada homestay di Ubud?",
		});
	});

	it("trims the body", () => {
		const result = classifyWebhook(
			withPayload({ from: "6281234567890@c.us", body: "  halo \n" }),
		);
		expect(result).toMatchObject({ kind: "message", text: "halo" });
	});

	it("accepts extra unknown fields", () => {
		const result = classifyWebhook({
			...valid,
			id: "evt_1",
			session: "default",
			payload: { ...valid.payload, id: "abc", timestamp: 1, _data: { x: 1 } },
		});
		expect(result.kind).toBe("message");
	});

	it.each([
		["@s.whatsapp.net", "6281234567890@s.whatsapp.net"],
		["bare digits", "6281234567890"],
	])("accepts %s and keeps from byte-for-byte", (_name, from) => {
		expect(classifyWebhook(withPayload({ from, body: "hi" }))).toMatchObject({
			kind: "message",
			to: from,
		});
	});

	it.each(["@c.us", "@s.whatsapp.net", ""])(
		"accepts 8 and 15 digit ids and rejects 7 and 16 (suffix %j)",
		(suffix) => {
			const kindFor = (digits: number) =>
				classifyWebhook(
					withPayload({ from: `${"1".repeat(digits)}${suffix}`, body: "hi" }),
				).kind;
			expect(kindFor(7)).toBe("invalid");
			expect(kindFor(8)).toBe("message");
			expect(kindFor(15)).toBe("message");
			expect(kindFor(16)).toBe("invalid");
		},
	);

	it.each([
		["missing event", { payload: valid.payload }],
		["empty event", withPayload(valid.payload, "")],
		["non-string event", withPayload(valid.payload, 1)],
		["missing payload", { event: "message" }],
		["non-object payload", withPayload("hi")],
		["array payload", withPayload([])],
		["missing from", withPayload({ body: "hi" })],
		["missing body", withPayload({ from: valid.payload.from })],
		["empty body", withPayload({ from: valid.payload.from, body: "" })],
		[
			"whitespace body",
			withPayload({ from: valid.payload.from, body: " \n\t " }),
		],
		["non-string body", withPayload({ from: valid.payload.from, body: 123 })],
		[
			"body over 4000 chars",
			withPayload({ from: valid.payload.from, body: "a".repeat(4001) }),
		],
		["non-string from", withPayload({ from: 6281234567890, body: "hi" })],
		["group id", withPayload({ from: "6281234567890-1234@g.us", body: "hi" })],
		["digit group id", withPayload({ from: "6281234567890@g.us", body: "hi" })],
		["letters in from", withPayload({ from: "abc@c.us", body: "hi" })],
		["unknown suffix", withPayload({ from: "6281234567890@lid", body: "hi" })],
		[
			"whitespace around from",
			withPayload({ from: " 6281234567890@c.us", body: "hi" }),
		],
		["non-boolean fromMe", withPayload({ ...valid.payload, fromMe: "yes" })],
		["null", null],
		["string", "message"],
		["array", [valid]],
		["number", 1],
		["undefined", undefined],
	])("rejects %s as invalid", (_name, input) => {
		const result = classifyWebhook(input);
		expect(result.kind).toBe("invalid");
		if (result.kind === "invalid") {
			expect(result.issues.length).toBeGreaterThan(0);
		}
	});

	it("accepts a body of exactly 4000 characters", () => {
		const result = classifyWebhook(
			withPayload({ from: valid.payload.from, body: "a".repeat(4000) }),
		);
		expect(result.kind).toBe("message");
	});

	it("ignores events other than message", () => {
		const result = classifyWebhook(
			withPayload(valid.payload, "session.status"),
		);
		expect(result.kind).toBe("ignored");
	});

	it("ignores messages sent by the bot itself", () => {
		const result = classifyWebhook(
			withPayload({ ...valid.payload, fromMe: true }),
		);
		expect(result.kind).toBe("ignored");
	});

	it("processes fromMe: false", () => {
		const result = classifyWebhook(
			withPayload({ ...valid.payload, fromMe: false }),
		);
		expect(result.kind).toBe("message");
	});

	it("validates before ignoring", () => {
		expect(
			classifyWebhook(
				withPayload({ from: "x@g.us", body: "hi" }, "session.status"),
			).kind,
		).toBe("invalid");
	});
});

describe("buildReply", () => {
	it("returns exactly to and reply", () => {
		const reply = buildReply("6281234567890@c.us", "Halo!");
		expect(Object.keys(reply)).toEqual(["to", "reply"]);
		expect(reply).toEqual({ to: "6281234567890@c.us", reply: "Halo!" });
	});
});
