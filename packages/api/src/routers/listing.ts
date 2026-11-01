import { listing } from "@myrehat-task-b/db/schema/listing";
import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import { createListingInput } from "../listing";

export const listingRouter = {
	create: protectedProcedure
		.input(createListingInput)
		.handler(async ({ context, input }) => {
			const [created] = await context.db
				.insert(listing)
				.values({ ...input, userId: context.session.user.id })
				.returning();
			if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
			return created;
		}),
	list: publicProcedure.handler(({ context }) =>
		context.db.query.listing.findMany({ orderBy: { createdAt: "desc" } }),
	),
};

export type ListingInputs = InferRouterInputs<typeof listingRouter>;
export type ListingOutputs = InferRouterOutputs<typeof listingRouter>;
