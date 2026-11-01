import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { generateText, type LanguageModel } from "ai";
import { createOpencode, OpencodeModels } from "ai-sdk-provider-opencode-sdk";
import { z } from "zod";
import { LISTING_CATEGORIES } from "../packages/db/src/listing";

export class PolishError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PolishError";
	}
}

export const polishInputSchema = z.object({
	description: z.string().trim().min(1).max(5000),
	title: z.string().optional(),
	location: z.string().optional(),
	price: z.number().int().positive().optional(),
	category: z.enum(LISTING_CATEGORIES).optional(),
});

export type PolishInput = z.infer<typeof polishInputSchema>;

export const POLISH_SYSTEM_PROMPT = `You are a copywriter for BuyHomestay, a marketplace for homestay properties, land and Airbnb businesses in Indonesia.
Rewrite the seller's listing description so it reads clearly, fluently and professionally.
Rules:
- Write in the same language as the original (Indonesian stays Indonesian, English stays English).
- Preserve EVERY fact from the original: numbers, names, sizes, prices, locations and conditions.
- Do NOT add amenities, distances, prices, legal status, ownership or certificate facts that are not in the original.
- Use a warm, inviting tone and correct grammar and spelling.
- Plain text only: no markdown, no emojis, no hashtags, no headings, no bullet lists.
- Use around 120 words or fewer.
- Do not use any tools. Reply with the polished description only, with no preface, notes or quotation marks.`;

export function buildPolishPrompt(input: PolishInput): string {
	const lines: string[] = [];
	if (input.title !== undefined) lines.push(`Title: ${input.title}`);
	if (input.location !== undefined) lines.push(`Location: ${input.location}`);
	if (input.category) lines.push(`Category: ${input.category}`);
	if (input.price !== undefined) lines.push(`Price (IDR): ${input.price}`);
	if (lines.length > 0) lines.push("");
	lines.push(
		"Original description (between the markers):",
		"<<<DESCRIPTION",
		input.description,
		"DESCRIPTION>>>",
	);
	return lines.join("\n");
}

const WRAPPING_QUOTES: [string, string][] = [
	['"', '"'],
	["'", "'"],
	["“", "”"],
	["‘", "’"],
];

function stripOneWrapper(text: string): string {
	if (text.length >= 6 && text.startsWith("```") && text.endsWith("```")) {
		const inner = text.slice(3, -3);
		// Multi-line: the first line is a language tag; single-line: it is content.
		const newline = inner.indexOf("\n");
		return (newline === -1 ? inner : inner.slice(newline + 1)).trim();
	}
	for (const [open, close] of WRAPPING_QUOTES) {
		if (text.length >= 2 && text.startsWith(open) && text.endsWith(close))
			return text.slice(1, -1).trim();
	}
	return text;
}

export function cleanPolishedText(text: string): string {
	let out = text.trim();
	for (
		let next = stripOneWrapper(out);
		next !== out;
		next = stripOneWrapper(out)
	)
		out = next;
	out = out.replace(/\n{3,}/g, "\n\n").trim();
	if (!out) throw new PolishError("The model returned an empty description.");
	return out;
}

const CANNOT_REACH = "Cannot reach OpenCode";

function errorChainText(error: unknown): string {
	const parts: string[] = [];
	let current: unknown = error;
	for (let i = 0; i < 5 && current; i++) {
		if (current instanceof Error) {
			parts.push(current.message);
			const e = current as Error & { lastError?: unknown };
			current = e.lastError ?? e.cause;
		} else {
			parts.push(String(current));
			break;
		}
	}
	return parts.join(" | ");
}

export async function polishDescription(
	input: unknown,
	options: { model: LanguageModel; abortSignal?: AbortSignal },
): Promise<string> {
	const parsed = polishInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new PolishError(
			`Invalid input: ${parsed.error.issues
				.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
				.join("; ")}`,
		);
	}
	let text: string;
	try {
		const result = await generateText({
			model: options.model,
			system: POLISH_SYSTEM_PROMPT,
			prompt: buildPolishPrompt(parsed.data),
			maxRetries: 0,
			abortSignal:
				options.abortSignal ?? AbortSignal.timeout(OVERALL_TIMEOUT_MS),
		});
		text = result.text;
	} catch (error) {
		const chain = errorChainText(error);
		if (
			/Failed to reach OpenCode|abort|timeout|timed out|ECONNREFUSED/i.test(
				chain,
			)
		) {
			throw new PolishError(
				`${CANNOT_REACH}: no response from the server in time.`,
			);
		}
		throw new PolishError("The AI request failed.");
	}
	return cleanPolishedText(text);
}

const INFO_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 60_000;
const OVERALL_TIMEOUT_MS = 120_000;

export function basicAuthHeader(password: string): string {
	return `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
}

function requestUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	if (input && typeof (input as Request).url === "string")
		return (input as Request).url;
	return "";
}

/** Bounds every request except the long-lived /api/event SSE stream. */
const timeoutFetch = (
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
): Promise<Response> => {
	const url = requestUrl(input);
	let path = url;
	try {
		path = new URL(url).pathname;
	} catch {}
	if (path.endsWith("/api/event")) return fetch(input, init);
	const ms = path.endsWith("/api/info") ? INFO_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
	const signals = [AbortSignal.timeout(ms)];
	if (init?.signal) signals.push(init.signal);
	return fetch(input, { ...init, signal: AbortSignal.any(signals) });
};

export const DEFAULT_BASE_URL = "http://127.0.0.1:4096";
export const DEFAULT_MODEL = OpencodeModels["big-pickle"];

export function createPolishProvider(
	env: Record<string, string | undefined> = process.env,
) {
	const password = env.OPENCODE_PASSWORD;
	if (!password) {
		throw new PolishError(
			"OPENCODE_PASSWORD is not set. Set it in the environment to the password of your running OpenCode server.",
		);
	}
	const baseUrl = env.OPENCODE_BASE_URL || DEFAULT_BASE_URL;
	return createOpencode({
		baseUrl,
		autoStart: false,
		clientOptions: {
			headers: { Authorization: basicAuthHeader(password) },
			fetch: timeoutFetch as typeof fetch,
		},
	});
}

export function safeBaseUrl(raw: string): string {
	try {
		const u = new URL(raw);
		return `${u.protocol}//${u.host}`;
	} catch {
		return "(invalid OPENCODE_BASE_URL)";
	}
}

export function cannotReachMessage(
	env: Record<string, string | undefined> = process.env,
): string {
	return `Cannot reach OpenCode at ${safeBaseUrl(env.OPENCODE_BASE_URL || DEFAULT_BASE_URL)}. Start it yourself in another terminal with:\n  OPENCODE_PASSWORD=… npx @opencode/cli@2.0.24 serve --port 4096`;
}

export type PolishResult =
	| { ok: true; polishedDescription: string }
	| { ok: false; error: string };

export async function polishMany(
	inputs: unknown[],
	options: { createModel: () => LanguageModel },
): Promise<PolishResult[]> {
	const results: PolishResult[] = [];
	for (const input of inputs) {
		try {
			const model = options.createModel();
			const polishedDescription = await polishDescription(input, { model });
			results.push({ ok: true, polishedDescription });
		} catch (error) {
			results.push({
				ok: false,
				error:
					error instanceof PolishError ? error.message : "Polishing failed.",
			});
		}
	}
	return results;
}

const HELP = `Usage:
  bun scripts/polish.ts --text "<description>" [--title T] [--location L] [--category C] [--price N]
  bun scripts/polish.ts --file listings.json

Options:
  --text      Listing description to polish (prints polished text)
  --title     Listing title (context)
  --location  Listing location (context)
  --category  One of: ${LISTING_CATEGORIES.join(", ")}
  --price     Price in IDR (positive integer)
  --file      JSON file with an object or array of objects
              ({description, title?, location?, category?, price?});
              prints a JSON array with polishedDescription or error
  --help      Show this help

Environment:
  OPENCODE_PASSWORD   required; password of the running OpenCode server
  OPENCODE_BASE_URL   default ${DEFAULT_BASE_URL}
  OPENCODE_MODEL      default ${DEFAULT_MODEL}

Exit codes: 0 success, 1 failure, 2 usage error.
`;

export interface Provider {
	(modelId: string): LanguageModel;
	dispose(): Promise<void>;
}

export interface MainDeps {
	env?: Record<string, string | undefined>;
	createProvider?: (env: Record<string, string | undefined>) => Provider;
	stdout?: { write(s: string): unknown };
	stderr?: { write(s: string): unknown };
	readFile?: (path: string) => Promise<string>;
}

export async function main(
	argv: string[],
	deps: MainDeps = {},
): Promise<number> {
	const env = deps.env ?? process.env;
	const out = deps.stdout ?? process.stdout;
	const err = deps.stderr ?? process.stderr;
	const read = deps.readFile ?? ((p: string) => readFile(p, "utf8"));
	const usage = (msg: string) => {
		err.write(`${msg}\nRun with --help for usage.\n`);
		return 2;
	};

	let values: Record<string, string | boolean | undefined>;
	try {
		({ values } = parseArgs({
			args: argv,
			options: {
				text: { type: "string" },
				title: { type: "string" },
				location: { type: "string" },
				category: { type: "string" },
				price: { type: "string" },
				file: { type: "string" },
				help: { type: "boolean" },
			},
			strict: true,
			allowPositionals: false,
		}));
	} catch (e) {
		return usage(e instanceof Error ? e.message : "Invalid arguments.");
	}

	if (values.help) {
		out.write(HELP);
		return 0;
	}
	if (argv.length === 0) {
		err.write(HELP);
		return 2;
	}

	const text = values.text as string | undefined;
	const file = values.file as string | undefined;
	if (text !== undefined && file !== undefined)
		return usage("--text and --file cannot be used together.");
	if (text === undefined && file === undefined)
		return usage("Provide --text or --file.");
	const hasContext =
		values.title !== undefined ||
		values.location !== undefined ||
		values.category !== undefined ||
		values.price !== undefined;
	if (file !== undefined && hasContext)
		return usage("--title/--location/--category/--price require --text.");

	let inputs: unknown[];
	if (file !== undefined) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(await read(file));
		} catch {
			return usage(`Could not read valid JSON from ${file}.`);
		}
		inputs = Array.isArray(parsed) ? parsed : [parsed];
		if (
			inputs.length === 0 ||
			inputs.some(
				(i) => typeof i !== "object" || i === null || Array.isArray(i),
			)
		)
			return usage(
				"--file must contain a JSON object or a non-empty array of objects.",
			);
	} else {
		const input: Record<string, unknown> = { description: text };
		if (values.title !== undefined) input.title = values.title;
		if (values.location !== undefined) input.location = values.location;
		if (values.category !== undefined) input.category = values.category;
		if (values.price !== undefined) {
			if (!/^\d+$/.test(values.price as string))
				return usage("--price must be a positive integer.");
			input.price = Number(values.price);
		}
		const check = polishInputSchema.safeParse(input);
		if (!check.success)
			return usage(
				`Invalid input: ${check.error.issues
					.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
					.join("; ")}`,
			);
		inputs = [input];
	}

	let provider: Provider | undefined;
	try {
		try {
			provider = (deps.createProvider ?? createPolishProvider)(env) as Provider;
		} catch (e) {
			err.write(
				`${e instanceof PolishError ? e.message : "Could not create the OpenCode provider."}\n`,
			);
			return 1;
		}
		const modelId = env.OPENCODE_MODEL || DEFAULT_MODEL;
		const p = provider;
		const results = await polishMany(inputs, {
			createModel: () => p(modelId),
		});

		const anyReach = results.some(
			(r) => !r.ok && r.error.startsWith(CANNOT_REACH),
		);
		if (anyReach) err.write(`${cannotReachMessage(env)}\n`);

		if (file !== undefined) {
			const output = inputs.map((input, i) => {
				const r = results[i] as PolishResult;
				return r.ok
					? { ...(input as object), polishedDescription: r.polishedDescription }
					: { ...(input as object), error: r.error };
			});
			out.write(`${JSON.stringify(output, null, 2)}\n`);
		} else {
			const r = results[0] as PolishResult;
			if (r.ok) out.write(`${r.polishedDescription}\n`);
			else if (!anyReach) err.write(`${r.error}\n`);
		}
		return results.every((r) => r.ok) ? 0 : 1;
	} finally {
		if (provider) await provider.dispose();
	}
}

function isDirectExecution(): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return fileURLToPath(import.meta.url) === entry;
	} catch {
		return false;
	}
}

if (isDirectExecution()) {
	main(process.argv.slice(2)).then(
		(code) => process.exit(code),
		() => {
			process.stderr.write("Unexpected error.\n");
			process.exit(1);
		},
	);
}
