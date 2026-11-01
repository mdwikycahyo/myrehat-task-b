import { MockLanguageModelV4 } from "ai/test";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { LISTING_CATEGORIES } from "../packages/db/src/listing";
import {
	basicAuthHeader,
	buildPolishPrompt,
	cleanPolishedText,
	createPolishProvider,
	main,
	POLISH_SYSTEM_PROMPT,
	PolishError,
	type PolishInput,
	type Provider,
	polishDescription,
	polishInputSchema,
	polishMany,
} from "./polish";

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const textResult = (text: string): GenerateResult => ({
	content: [{ type: "text", text }],
	finishReason: { unified: "stop", raw: undefined },
	usage: {
		inputTokens: {
			total: 1,
			noCache: 1,
			cacheRead: undefined,
			cacheWrite: undefined,
		},
		outputTokens: { total: 1, text: 1, reasoning: undefined },
	},
	warnings: [],
});

const mockModel = (text: string) =>
	new MockLanguageModelV4({ doGenerate: textResult(text) });

const throwingModel = (error: Error) =>
	new MockLanguageModelV4({
		doGenerate: async () => {
			throw error;
		},
	});

const promptText = (call: { prompt: unknown }) => JSON.stringify(call.prompt);

const blockedFetch = vi.fn(() => {
	throw new Error("network access is forbidden in tests");
});
const realFetch = globalThis.fetch;

beforeAll(() => {
	globalThis.fetch = blockedFetch as unknown as typeof fetch;
});
afterAll(() => {
	globalThis.fetch = realFetch;
});
afterEach(() => {
	// A swallowed fetch error would otherwise look like an expected failure.
	expect(blockedFetch).not.toHaveBeenCalled();
});

describe("polishInputSchema", () => {
	it.each(LISTING_CATEGORIES)("accepts category %s", (category) => {
		expect(
			polishInputSchema.safeParse({ description: "ok", category }).success,
		).toBe(true);
	});

	it("covers exactly the 4 shared categories", () => {
		expect(LISTING_CATEGORIES).toHaveLength(4);
	});

	it.each([
		["unknown category", { description: "ok", category: "Rent Villa" }],
		["empty description", { description: "" }],
		["whitespace description", { description: " \n\t " }],
		["negative price", { description: "ok", price: -5 }],
		["zero price", { description: "ok", price: 0 }],
		["non-integer price", { description: "ok", price: 1.5 }],
	])("rejects %s", (_name, input) => {
		expect(polishInputSchema.safeParse(input).success).toBe(false);
	});
});

describe("buildPolishPrompt", () => {
	it("includes present fields and the description verbatim", () => {
		const description = "  Villa  asri,\n\ndekat   pantai. <<<x>>> ";
		const input: PolishInput = {
			description,
			title: "Villa Asri",
			location: "Ubud",
			category: "Buy Property",
			price: 1500000000,
		};
		const prompt = buildPolishPrompt(input);
		expect(prompt).toContain("Title: Villa Asri");
		expect(prompt).toContain("Location: Ubud");
		expect(prompt).toContain("Category: Buy Property");
		expect(prompt).toContain("Price (IDR): 1500000000");
		expect(prompt).toContain(description);
	});

	it("omits missing fields", () => {
		const prompt = buildPolishPrompt({ description: "Hanya deskripsi" });
		expect(prompt).not.toMatch(/Title:|Location:|Category:|Price/);
		expect(prompt).toContain("Hanya deskripsi");
	});

	it("still renders present-but-empty title and location", () => {
		const prompt = buildPolishPrompt({
			description: "d",
			title: "",
			location: "",
		});
		expect(prompt).toContain("Title: \n");
		expect(prompt).toContain("Location: \n");
	});
});

describe("cleanPolishedText", () => {
	it.each([
		["code fence with language", "```text\nHalo dunia\n```", "Halo dunia"],
		["code fence without language", "```\nHalo dunia\n```", "Halo dunia"],
		["inline code fence", "```Halo dunia```", "Halo dunia"],
		["double quotes", '"Halo dunia"', "Halo dunia"],
		["single quotes", "'Halo dunia'", "Halo dunia"],
		["curly quotes", "“Halo dunia”", "Halo dunia"],
		["quotes inside fence", '```\n"Halo dunia"\n```', "Halo dunia"],
		["fence inside quotes", '"```\nHalo dunia\n```"', "Halo dunia"],
		["whitespace around wrapper", '  \n "Halo dunia" \n ', "Halo dunia"],
		["collapses 3+ newlines", "Satu\n\n\n\nDua", "Satu\n\nDua"],
		["keeps single blank line", "Satu\n\nDua", "Satu\n\nDua"],
		[
			"keeps inner quotes",
			'Villa "Indah" dekat pantai',
			'Villa "Indah" dekat pantai',
		],
		[
			"keeps inner quotes in wrapper",
			'"Villa "Indah" asri"',
			'Villa "Indah" asri',
		],
	])("%s", (_name, raw, expected) => {
		expect(cleanPolishedText(raw)).toBe(expected);
	});

	it("keeps a quoted phrase at each end of unwrapped text", () => {
		const text = '"Indah" sekali dan "murah"';
		expect(cleanPolishedText(text)).toBe(text);
	});

	it.each(["", "  \n ", '""', "```\n```"])("rejects empty output %j", (raw) => {
		expect(() => cleanPolishedText(raw)).toThrow(PolishError);
	});
});

describe("polishDescription", () => {
	it("returns cleaned model text", async () => {
		const model = mockModel('```\n"Villa asri di Ubud."\n```');
		await expect(
			polishDescription({ description: "villa asri ubud" }, { model }),
		).resolves.toBe("Villa asri di Ubud.");
	});

	it("sends the system prompt and built prompt to the model", async () => {
		const model = mockModel("ok");
		const input = {
			description: "rumah  2 lantai",
			title: "",
			price: 750000000,
			category: "Buy Property",
		} as const;
		await polishDescription(input, { model });

		expect(model.doGenerateCalls).toHaveLength(1);
		const { prompt } = model.doGenerateCalls[0] as { prompt: unknown[] };
		expect(prompt[0]).toMatchObject({
			role: "system",
			content: POLISH_SYSTEM_PROMPT,
		});
		const user = prompt[1] as { role: string; content: { text: string }[] };
		expect(user.role).toBe("user");
		expect(user.content[0]?.text).toBe(
			buildPolishPrompt(polishInputSchema.parse(input)),
		);
		expect(user.content[0]?.text).toContain("Title: \n");
		expect(user.content[0]?.text).toContain("rumah  2 lantai");
	});

	it("rejects invalid input without calling the model", async () => {
		const model = mockModel("ok");
		await expect(
			polishDescription({ description: "  " }, { model }),
		).rejects.toThrow(PolishError);
		expect(model.doGenerateCalls).toHaveLength(0);
	});

	it("throws PolishError for empty model output", async () => {
		await expect(
			polishDescription({ description: "x" }, { model: mockModel("  \n") }),
		).rejects.toThrow(PolishError);
	});

	it("wraps provider errors without leaking their message", async () => {
		const error = await polishDescription(
			{ description: "x" },
			{ model: throwingModel(new Error("SENTINEL-PASSWORD")) },
		).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(PolishError);
		expect((error as Error).message).not.toContain("SENTINEL-PASSWORD");
		expect(String((error as Error).stack)).not.toContain("SENTINEL-PASSWORD");
	});
});

describe("polishMany", () => {
	it("creates a fresh model per item, sequentially, and continues after failure", async () => {
		const events: string[] = [];
		const created: MockLanguageModelV4[] = [];
		const createModel = vi.fn(() => {
			const index = created.length;
			const model = new MockLanguageModelV4({
				doGenerate: async () => {
					events.push(`start${index}`);
					await new Promise((r) => setTimeout(r, 5));
					events.push(`end${index}`);
					if (index === 1) throw new Error("boom SENTINEL-PASSWORD");
					return textResult(`"polished ${index}"`);
				},
			});
			created.push(model);
			return model;
		});

		const results = await polishMany(
			[{ description: "a" }, { description: "b" }, { description: "c" }],
			{ createModel },
		);

		expect(createModel).toHaveBeenCalledTimes(3);
		expect(new Set(created).size).toBe(3);
		for (const model of created) expect(model.doGenerateCalls).toHaveLength(1);
		expect(events).toEqual([
			"start0",
			"end0",
			"start1",
			"end1",
			"start2",
			"end2",
		]);
		expect(results).toEqual([
			{ ok: true, polishedDescription: "polished 0" },
			{ ok: false, error: "The AI request failed." },
			{ ok: true, polishedDescription: "polished 2" },
		]);
	});

	it("reports invalid items and still creates a model for each", async () => {
		const createModel = vi.fn(() => mockModel("fine"));
		const results = await polishMany(
			[{ description: "" }, { description: "y" }],
			{
				createModel,
			},
		);
		expect(createModel).toHaveBeenCalledTimes(2);
		expect(results[0]?.ok).toBe(false);
		expect(results[1]).toEqual({ ok: true, polishedDescription: "fine" });
	});
});

describe("auth and provider construction", () => {
	it("builds the Basic header", () => {
		expect(basicAuthHeader("pw")).toBe(
			`Basic ${Buffer.from("opencode:pw").toString("base64")}`,
		);
		expect(basicAuthHeader("pw")).toBe("Basic b3BlbmNvZGU6cHc=");
	});

	it("requires OPENCODE_PASSWORD", () => {
		expect(() => createPolishProvider({})).toThrow(PolishError);
		expect(() => createPolishProvider({ OPENCODE_PASSWORD: "" })).toThrow(
			/OPENCODE_PASSWORD/,
		);
	});

	it("constructs the real provider and model without any fetch", async () => {
		const provider = createPolishProvider({
			OPENCODE_PASSWORD: "dummy",
			OPENCODE_BASE_URL: "http://opencode.invalid:4096",
		});
		const model = provider("opencode/big-pickle");
		expect(model).toBeDefined();
		expect(blockedFetch).not.toHaveBeenCalled();
		await provider.dispose();
		expect(blockedFetch).not.toHaveBeenCalled();
	});
});

describe("main", () => {
	function harness(
		options: {
			model?: (prompt: string) => string | Error;
			files?: Record<string, string>;
			createProviderThrows?: Error;
		} = {},
	) {
		let stdout = "";
		let stderr = "";
		const dispose = vi.fn(async () => {});
		const modelIds: string[] = [];
		const models: MockLanguageModelV4[] = [];
		const provider = Object.assign(
			(modelId: string) => {
				modelIds.push(modelId);
				const model = new MockLanguageModelV4({
					doGenerate: async (callOptions) => {
						const reply = (options.model ?? (() => "ok"))(
							promptText(callOptions),
						);
						if (reply instanceof Error) throw reply;
						return textResult(reply);
					},
				});
				models.push(model);
				return model;
			},
			{ dispose },
		) as Provider;
		const createProvider = vi.fn(() => {
			if (options.createProviderThrows) throw options.createProviderThrows;
			return provider;
		});
		const run = (argv: string[], env: Record<string, string> = {}) =>
			main(argv, {
				env: { OPENCODE_PASSWORD: "pw", ...env },
				createProvider,
				stdout: { write: (s) => (stdout += s) },
				stderr: { write: (s) => (stderr += s) },
				readFile: async (path) => {
					const content = options.files?.[path];
					if (content === undefined) throw new Error("ENOENT");
					return content;
				},
			});
		return {
			run,
			createProvider,
			dispose,
			modelIds,
			models,
			out: () => stdout,
			err: () => stderr,
		};
	}

	it("--text prints cleaned text and exits 0", async () => {
		const h = harness({ model: () => '"Villa indah."' });
		const code = await h.run(
			["--text", "villa", "--title", "T", "--category", "Buy Property"],
			{ OPENCODE_MODEL: "opencode/custom" },
		);
		expect(code).toBe(0);
		expect(h.out()).toBe("Villa indah.\n");
		expect(h.err()).toBe("");
		expect(h.modelIds).toEqual(["opencode/custom"]);
		expect(
			promptText(h.models[0]?.doGenerateCalls[0] as { prompt: unknown }),
		).toContain("Buy Property");
		expect(h.dispose).toHaveBeenCalledTimes(1);
	});

	it("no args prints usage and exits 2", async () => {
		const h = harness();
		expect(await h.run([])).toBe(2);
		expect(h.err()).toContain("Usage:");
		expect(h.createProvider).not.toHaveBeenCalled();
	});

	it("--help exits 0 without creating a provider", async () => {
		const h = harness();
		expect(await h.run(["--help"])).toBe(0);
		expect(h.out()).toContain("Usage:");
		expect(h.createProvider).not.toHaveBeenCalled();
	});

	it.each([
		["text and file", ["--text", "a", "--file", "f.json"]],
		["bad category", ["--text", "a", "--category", "Nope"]],
		["bad price", ["--text", "a", "--price", "-3"]],
		["blank text", ["--text", "  "]],
		["unknown flag", ["--bogus"]],
	])("usage error (%s) exits 2 without a provider", async (_n, argv) => {
		const h = harness();
		expect(await h.run(argv)).toBe(2);
		expect(h.createProvider).not.toHaveBeenCalled();
	});

	it("--file prints one JSON result per item and continues after a failure", async () => {
		const h = harness({
			files: {
				"in.json": JSON.stringify([
					{ description: "first", title: "A" },
					{ description: "BAD one" },
					{ description: "third" },
				]),
			},
			model: (prompt) =>
				prompt.includes("BAD")
					? new Error("SENTINEL-PASSWORD")
					: "```\nclean\n```",
		});
		const code = await h.run(["--file", "in.json"]);
		expect(code).toBe(1);
		expect(JSON.parse(h.out())).toEqual([
			{ description: "first", title: "A", polishedDescription: "clean" },
			{ description: "BAD one", error: "The AI request failed." },
			{ description: "third", polishedDescription: "clean" },
		]);
		expect(h.out()).not.toContain("SENTINEL-PASSWORD");
		expect(h.models).toHaveLength(3);
		expect(h.dispose).toHaveBeenCalledTimes(1);
	});

	it("--file with a single object still prints a JSON array", async () => {
		const h = harness({
			files: { "one.json": JSON.stringify({ description: "solo" }) },
			model: () => "polished",
		});
		expect(await h.run(["--file", "one.json"])).toBe(0);
		expect(JSON.parse(h.out())).toEqual([
			{ description: "solo", polishedDescription: "polished" },
		]);
	});

	it.each([
		["missing file", "nope.json"],
		["invalid JSON", "bad.json"],
		["empty array", "empty.json"],
		["non-object items", "nums.json"],
	])("--file %s exits 2", async (_n, file) => {
		const h = harness({
			files: {
				"bad.json": "{not json",
				"empty.json": "[]",
				"nums.json": "[1, 2]",
			},
		});
		expect(await h.run(["--file", file])).toBe(2);
		expect(h.createProvider).not.toHaveBeenCalled();
	});

	it("disposes the provider even when polishing fails", async () => {
		const h = harness({ model: () => new Error("down") });
		expect(await h.run(["--text", "x"])).toBe(1);
		expect(h.err()).toContain("The AI request failed.");
		expect(h.out()).toBe("");
		expect(h.dispose).toHaveBeenCalledTimes(1);
	});

	it("reports provider creation failure with exit 1", async () => {
		const h = harness({
			createProviderThrows: new PolishError("OPENCODE_PASSWORD is not set."),
		});
		expect(await h.run(["--text", "x"])).toBe(1);
		expect(h.err()).toContain("OPENCODE_PASSWORD is not set.");
		expect(h.dispose).not.toHaveBeenCalled();
	});

	it("default provider factory fails cleanly without OPENCODE_PASSWORD", async () => {
		let stderr = "";
		const code = await main(["--text", "x"], {
			env: {},
			stdout: { write: () => {} },
			stderr: { write: (s) => (stderr += s) },
		});
		expect(code).toBe(1);
		expect(stderr).toContain("OPENCODE_PASSWORD");
	});
});
