"use client";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const { data: session } = authClient.useSession();

	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
		{ to: "/ai", label: "AI Chat" },
		{ to: "/listings", label: "Listings" },
		...(session
			? ([{ to: "/listings/new", label: "Create listing" }] as const)
			: []),
	] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between gap-2 px-2 py-1">
				<nav className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm sm:gap-x-4 sm:text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link key={to} href={to} className="whitespace-nowrap">
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="flex shrink-0 items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</div>
	);
}
