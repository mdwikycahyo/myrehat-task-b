"use client";
import { buttonVariants } from "@myrehat-task-b/ui/components/button";
import { Skeleton } from "@myrehat-task-b/ui/components/skeleton";
import { cn } from "@myrehat-task-b/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const CTA = "h-11 w-full px-4 text-sm sm:w-44";

export default function Home() {
	const healthCheck = useQuery(orpc.healthCheck.queryOptions());
	const { data: session, isPending } = authClient.useSession();

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
			<section className="flex max-w-2xl flex-col gap-5">
				<h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
					Book homestays directly with hosts
				</h1>
				<p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
					Browse homestay listings and message hosts directly on WhatsApp.
				</p>
				<div className="mt-3 flex flex-col gap-3 sm:flex-row">
					<Link
						href="/listings"
						className={cn(buttonVariants({ size: "lg" }), CTA)}
					>
						Browse listings
						<ArrowRightIcon data-icon="inline-end" aria-hidden />
					</Link>
					{isPending ? (
						<Skeleton className={CTA} aria-hidden />
					) : session ? (
						<Link
							href="/listings/new"
							className={cn(
								buttonVariants({ size: "lg", variant: "outline" }),
								CTA,
							)}
						>
							Create listing
						</Link>
					) : (
						<Link
							href="/login"
							className={cn(
								buttonVariants({ size: "lg", variant: "outline" }),
								CTA,
							)}
						>
							Sign in
						</Link>
					)}
				</div>
			</section>
			<p
				role="status"
				className="text-muted-foreground mt-12 flex items-center gap-2 text-xs sm:mt-16"
			>
				<span
					aria-hidden
					className={cn(
						"size-1.5 rounded-full",
						healthCheck.isLoading
							? "bg-muted-foreground/40 animate-pulse"
							: healthCheck.data
								? "bg-green-500"
								: "bg-red-500",
					)}
				/>
				{healthCheck.isLoading
					? "Checking API…"
					: healthCheck.data
						? "API connected"
						: "API disconnected"}
			</p>
		</main>
	);
}
