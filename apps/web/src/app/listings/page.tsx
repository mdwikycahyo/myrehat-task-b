import type { Metadata } from "next";

import ListingsGrid from "./listings-grid";

export const metadata: Metadata = {
	title: "Listings · BuyHomestay",
	description:
		"Browse homestay properties, land and Airbnb businesses for sale.",
};

export default function ListingsPage() {
	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
			<div className="mb-6 flex flex-col gap-1">
				<h1 className="text-xl font-semibold tracking-tight text-balance">
					BuyHomestay listings
				</h1>
				<p className="text-muted-foreground text-sm">
					Properties, land and Airbnb businesses for sale. Contact sellers
					directly on WhatsApp.
				</p>
			</div>
			<ListingsGrid />
		</main>
	);
}
