"use client";
import { Button } from "@myrehat-task-b/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@myrehat-task-b/ui/components/dropdown-menu";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const { data: session } = authClient.useSession();
	const pathname = usePathname();

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
				<nav
					aria-label="Main"
					className="hidden min-w-0 flex-wrap gap-x-4 gap-y-1 text-lg sm:flex"
				>
					{links.map(({ to, label }) => {
						return (
							<Link
								key={to}
								href={to}
								aria-current={pathname === to ? "page" : undefined}
								className="whitespace-nowrap"
							>
								{label}
							</Link>
						);
					})}
				</nav>
				<nav aria-label="Main" className="sm:hidden">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="icon" />}
						>
							<MenuIcon />
							<span className="sr-only">Menu</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="min-w-44">
							{links.map(({ to, label }) => (
								<DropdownMenuItem
									key={to}
									render={
										<Link
											href={to}
											aria-current={pathname === to ? "page" : undefined}
										/>
									}
									className="text-sm aria-[current=page]:font-semibold"
								>
									{label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
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
