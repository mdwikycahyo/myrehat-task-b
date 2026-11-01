import { describe, expect, it } from "vitest";

import { createListingInput, LISTING_CATEGORIES } from "./listing";

const valid = {
	title: "Villa Ubud",
	price: 1500000000,
	location: "Ubud, Bali",
	category: LISTING_CATEGORIES[0],
	whatsapp: "081234567890",
};

describe("LISTING_CATEGORIES", () => {
	it("has exactly the four required options in order", () => {
		expect([...LISTING_CATEGORIES]).toEqual([
			"Buy Property",
			"Buy land to build homestay",
			"Buy Airbnb Profile",
			"Buy Airbnb Business",
		]);
	});
});

describe("createListingInput", () => {
	it.each(LISTING_CATEGORIES)("accepts category %s", (category) => {
		expect(createListingInput.safeParse({ ...valid, category }).success).toBe(
			true,
		);
	});

	it("rejects an unknown category", () => {
		expect(
			createListingInput.safeParse({ ...valid, category: "Rent Villa" })
				.success,
		).toBe(false);
	});

	it("rejects empty or too-short titles", () => {
		expect(createListingInput.safeParse({ ...valid, title: "" }).success).toBe(
			false,
		);
		expect(
			createListingInput.safeParse({ ...valid, title: "  ab  " }).success,
		).toBe(false);
	});

	it.each([0, -5, 10.5, "abc"])("rejects invalid price %s", (price) => {
		expect(createListingInput.safeParse({ ...valid, price }).success).toBe(
			false,
		);
	});

	it("coerces numeric price strings and trims text", () => {
		const r = createListingInput.parse({
			...valid,
			price: "250000",
			title: "  Villa  ",
		});
		expect(r.price).toBe(250000);
		expect(r.title).toBe("Villa");
	});

	it.each([
		["081234567890", "6281234567890"],
		["6281234567890", "6281234567890"],
		["+6281234567890", "6281234567890"],
		["0812-3456-7890", "6281234567890"],
	])("normalizes whatsapp %s", (input, expected) => {
		expect(
			createListingInput.parse({ ...valid, whatsapp: input }).whatsapp,
		).toBe(expected);
	});

	it.each(["12345", "0712345678901", "08123", "0812345678901234", "abc", ""])(
		"rejects bad whatsapp %s",
		(whatsapp) => {
			expect(createListingInput.safeParse({ ...valid, whatsapp }).success).toBe(
				false,
			);
		},
	);
});
