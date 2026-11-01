import type { Context as ApiContext } from "@myrehat-task-b/api/context";
import type { Context as ElysiaContext } from "elysia";
import { auth, db } from "./services";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		db,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
