import { z } from "zod";

export const LISTING_CATEGORIES = [
	"Buy Property",
	"Buy land to build homestay",
	"Buy Airbnb Profile",
	"Buy Airbnb Business",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

/** Accepts 08…, 628… and +628…; normalizes to 628… digits only (10–15 digits). */
const whatsappNumber = z
	.string()
	.trim()
	.transform((value) => value.replace(/[\s-]/g, ""))
	.pipe(
		z.string().regex(/^(\+62|62|0)8\d+$/, "Invalid Indonesian WhatsApp number"),
	)
	.transform((value) => value.replace(/^\+?62|^0/, "62"))
	.pipe(
		z
			.string()
			.min(10, "WhatsApp number is too short")
			.max(15, "WhatsApp number is too long"),
	);

export const createListingInput = z.object({
	title: z.string().trim().min(3).max(120),
	price: z.coerce.number().int().positive(),
	location: z.string().trim().min(2).max(120),
	category: z.enum(LISTING_CATEGORIES),
	whatsapp: whatsappNumber,
});

export type CreateListingInput = z.infer<typeof createListingInput>;
