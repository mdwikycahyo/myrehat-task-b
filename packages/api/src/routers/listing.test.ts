import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import type { Context } from "../context";
import { listingRouter } from "./listing";

describe("listing.create", () => {
	it("rejects a valid request without a session with UNAUTHORIZED", async () => {
		// db is never reached: auth middleware throws first.
		const context = { session: null, db: {} } as unknown as Context;
		await expect(
			call(
				listingRouter.create,
				{
					title: "Villa in Ubud",
					price: 1_500_000_000,
					location: "Ubud, Bali",
					category: "Buy Property",
					whatsapp: "081234567890",
				},
				{ context },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
