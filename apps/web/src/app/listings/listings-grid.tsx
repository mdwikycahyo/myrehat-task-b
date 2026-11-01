"use client";

import { Button, buttonVariants } from "@myrehat-task-b/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@myrehat-task-b/ui/components/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@myrehat-task-b/ui/components/empty";
import { Skeleton } from "@myrehat-task-b/ui/components/skeleton";
import { cn } from "@myrehat-task-b/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	HouseIcon,
	MapPinIcon,
	MessageCircleIcon,
	RotateCwIcon,
} from "lucide-react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const priceFormat = new Intl.NumberFormat("id-ID", {
	style: "currency",
	currency: "IDR",
	maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** wa.me expects international digits only: 08… / +628… → 628… */
function toWaMeNumber(raw: string) {
	return raw.replace(/\D/g, "").replace(/^0/, "62");
}

export default function ListingsGrid() {
	const listings = useQuery(orpc.listing.list.queryOptions());

	if (listings.isPending) {
		return (
			<ul className={GRID} aria-busy="true" aria-label="Loading listings">
				{Array.from({ length: 6 }, (_, i) => (
					<li key={i}>
						<ListingCardSkeleton />
					</li>
				))}
			</ul>
		);
	}

	if (listings.isError) {
		return (
			<Empty className="border" role="alert">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<AlertCircleIcon className="text-destructive" />
					</EmptyMedia>
					<EmptyTitle>Couldn’t load listings</EmptyTitle>
					<EmptyDescription>{listings.error.message}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						variant="outline"
						onClick={() => listings.refetch()}
						disabled={listings.isFetching}
					>
						<RotateCwIcon
							data-icon="inline-start"
							className={listings.isFetching ? "animate-spin" : undefined}
						/>
						Try again
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	if (listings.data.length === 0) {
		return <EmptyListings />;
	}

	return (
		<ul className={GRID}>
			{listings.data.map((item) => (
				<li key={item.id} className="flex">
					<Card className="w-full">
						<CardHeader>
							<span className="bg-muted text-muted-foreground inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium">
								{item.category}
							</span>
							<CardTitle className="mt-1 text-base/snug text-pretty">
								<h2>{item.title}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-2">
							<p className="text-lg font-semibold tabular-nums">
								{priceFormat.format(item.price)}
							</p>
							<p className="text-muted-foreground flex items-start gap-1.5 text-sm">
								<MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
								<span className="min-w-0 break-words">{item.location}</span>
							</p>
						</CardContent>
						<CardFooter className="justify-between gap-2">
							<time
								dateTime={new Date(item.createdAt).toISOString()}
								className="text-muted-foreground"
							>
								{dateFormat.format(new Date(item.createdAt))}
							</time>
							<a
								href={`https://wa.me/${toWaMeNumber(item.whatsapp)}`}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(buttonVariants({ size: "lg" }))}
							>
								<MessageCircleIcon data-icon="inline-start" aria-hidden />
								Chat on WhatsApp
								<span className="sr-only"> (opens in a new tab)</span>
							</a>
						</CardFooter>
					</Card>
				</li>
			))}
		</ul>
	);
}

function ListingCardSkeleton() {
	return (
		<Card className="w-full">
			<CardHeader>
				<Skeleton className="h-4 w-28" />
				<Skeleton className="mt-1 h-5 w-3/4" />
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<Skeleton className="h-7 w-40" />
				<Skeleton className="h-4 w-1/2" />
			</CardContent>
			<CardFooter className="justify-between gap-2">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-9 w-36" />
			</CardFooter>
		</Card>
	);
}

function EmptyListings() {
	const { data: session, isPending } = authClient.useSession();

	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<HouseIcon />
				</EmptyMedia>
				<EmptyTitle>No listings yet</EmptyTitle>
				<EmptyDescription>
					{session
						? "Be the first to list a property, plot of land or Airbnb business."
						: "Sign in to post the first property, plot of land or Airbnb business."}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				{isPending ? (
					<Skeleton className="h-9 w-36" />
				) : session ? (
					<Link
						href="/listings/new"
						className={cn(buttonVariants({ size: "lg" }))}
					>
						Create listing
					</Link>
				) : (
					<Link
						href="/login"
						className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
					>
						Sign in to create a listing
					</Link>
				)}
			</EmptyContent>
		</Empty>
	);
}
