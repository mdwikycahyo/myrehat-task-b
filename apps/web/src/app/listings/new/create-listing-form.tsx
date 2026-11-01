"use client";

import {
	createListingInput,
	LISTING_CATEGORIES,
} from "@myrehat-task-b/api/listing";
import { Button, buttonVariants } from "@myrehat-task-b/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@myrehat-task-b/ui/components/card";
import { Input } from "@myrehat-task-b/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@myrehat-task-b/ui/components/input-group";
import { Label } from "@myrehat-task-b/ui/components/label";
import { Skeleton } from "@myrehat-task-b/ui/components/skeleton";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const idr = new Intl.NumberFormat("id-ID", {
	style: "currency",
	currency: "IDR",
	maximumFractionDigits: 0,
});

type FieldMeta = {
	isBlurred: boolean;
	errors: ReadonlyArray<{ message?: string } | undefined>;
};

// createListingInput decides validity; these replace zod's generic wording.
// WhatsApp keeps the schema's own messages, which are already user-facing.
const ERROR_COPY: Partial<Record<string, string>> = {
	title: "Use 3 to 120 characters.",
	price: "Enter a whole rupiah amount above 0.",
	location: "Use 2 to 120 characters.",
};

// Errors stay hidden while a field is first typed in, then track every change.
function fieldError(name: string, meta: FieldMeta, submitted: boolean) {
	const message = meta.errors[0]?.message;
	if (!message || !(meta.isBlurred || submitted)) return undefined;
	return ERROR_COPY[name] ?? message;
}

function FieldError({ id, message }: { id: string; message?: string }) {
	if (!message) return null;
	return (
		<p id={id} className="text-destructive text-xs">
			{message}
		</p>
	);
}

export default function CreateListingForm() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();

	const createListing = useMutation(
		orpc.listing.create.mutationOptions({
			onSuccess: async () => {
				toast.success("Listing published");
				await queryClient.invalidateQueries({
					queryKey: orpc.listing.list.queryKey(),
				});
				router.push("/listings");
			},
			onError: (error) => {
				toast.error(error.message || "Could not create listing");
			},
		}),
	);

	const form = useForm({
		defaultValues: {
			title: "",
			// Matches createListingInput's z.coerce input type so the shared schema validates the form.
			price: "" as unknown,
			location: "",
			category: LISTING_CATEGORIES[0] as string,
			whatsapp: "",
		},
		validators: {
			onChange: createListingInput,
		},
		onSubmit: async ({ value }) => {
			try {
				await createListing.mutateAsync(createListingInput.parse(value));
			} catch {
				// Surfaced by the mutation's onError toast.
			}
		},
	});
	const submitted = useStore(
		form.store,
		(state) => state.submissionAttempts > 0,
	);

	if (isPending) {
		return <FormSkeleton />;
	}

	if (!session) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Sign in to create a listing</CardTitle>
					<CardDescription>
						You need an account to publish a BuyHomestay listing. Browsing
						listings is open to everyone.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Link href="/login" className={buttonVariants()}>
						Sign in
					</Link>
					<Link
						href="/listings"
						className={buttonVariants({ variant: "outline" })}
					>
						Browse listings
					</Link>
				</CardContent>
			</Card>
		);
	}

	const busy = createListing.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h1 className="text-base font-medium">Create BuyHomestay listing</h1>
				</CardTitle>
				<CardDescription>
					Buyers contact you directly on WhatsApp.
				</CardDescription>
			</CardHeader>

			<form
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="flex flex-col gap-(--card-spacing)"
			>
				<CardContent className="space-y-4">
					<form.Field name="title">
						{(field) => {
							const error = fieldError(field.name, field.state.meta, submitted);
							return (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Title</Label>
									<Input
										id={field.name}
										name={field.name}
										placeholder="e.g. 3-bedroom homestay near Ubud"
										autoComplete="off"
										disabled={busy}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={!!error}
										aria-describedby={error ? `${field.name}-error` : undefined}
									/>
									<FieldError id={`${field.name}-error`} message={error} />
								</div>
							);
						}}
					</form.Field>

					<form.Field name="price">
						{(field) => {
							const error = fieldError(field.name, field.state.meta, submitted);
							const amount = Number(field.state.value);
							return (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Price</Label>
									<InputGroup data-disabled={busy}>
										<InputGroupAddon>
											<InputGroupText>Rp</InputGroupText>
										</InputGroupAddon>
										<InputGroupInput
											id={field.name}
											name={field.name}
											type="number"
											min={1}
											step={1}
											inputMode="numeric"
											placeholder="e.g. 750000000"
											autoComplete="off"
											disabled={busy}
											value={String(field.state.value)}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={!!error}
											aria-describedby={`${field.name}-${error ? "error" : "hint"}`}
										/>
									</InputGroup>
									{error ? (
										<FieldError id={`${field.name}-error`} message={error} />
									) : (
										<p
											id={`${field.name}-hint`}
											className="text-muted-foreground text-xs tabular-nums"
										>
											{Number.isInteger(amount) && amount > 0
												? idr.format(amount)
												: "Whole rupiah, no decimals."}
										</p>
									)}
								</div>
							);
						}}
					</form.Field>

					<form.Field name="location">
						{(field) => {
							const error = fieldError(field.name, field.state.meta, submitted);
							return (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Location</Label>
									<Input
										id={field.name}
										name={field.name}
										placeholder="e.g. Ubud, Bali"
										autoComplete="off"
										disabled={busy}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={!!error}
										aria-describedby={error ? `${field.name}-error` : undefined}
									/>
									<FieldError id={`${field.name}-error`} message={error} />
								</div>
							);
						}}
					</form.Field>

					<form.Field name="category">
						{(field) => {
							const error = fieldError(field.name, field.state.meta, submitted);
							return (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Category</Label>
									<div className="relative">
										<select
											id={field.name}
											name={field.name}
											disabled={busy}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={!!error}
											aria-describedby={
												error ? `${field.name}-error` : undefined
											}
											className="border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:disabled:bg-input/80 h-8 w-full min-w-0 appearance-none rounded-none border bg-transparent py-1 pr-8 pl-2.5 text-xs transition-colors outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1"
										>
											{LISTING_CATEGORIES.map((category) => (
												<option key={category} value={category}>
													{category}
												</option>
											))}
										</select>
										<ChevronDown
											aria-hidden
											className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
										/>
									</div>
									<FieldError id={`${field.name}-error`} message={error} />
								</div>
							);
						}}
					</form.Field>

					<form.Field name="whatsapp">
						{(field) => {
							const error = fieldError(field.name, field.state.meta, submitted);
							return (
								<div className="space-y-2">
									<Label htmlFor={field.name}>WhatsApp number</Label>
									<Input
										id={field.name}
										name={field.name}
										type="tel"
										inputMode="tel"
										autoComplete="tel"
										placeholder="08xxxxxxxxxx"
										disabled={busy}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={!!error}
										aria-describedby={`${field.name}-hint${error ? ` ${field.name}-error` : ""}`}
									/>
									<p
										id={`${field.name}-hint`}
										className="text-muted-foreground text-xs"
									>
										Starts with 08, 628 or +628.
									</p>
									<FieldError id={`${field.name}-error`} message={error} />
								</div>
							);
						}}
					</form.Field>
				</CardContent>

				<CardFooter>
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button
								type="submit"
								className="w-full"
								disabled={busy || isSubmitting}
							>
								{busy || isSubmitting ? (
									<>
										<Loader2 className="animate-spin" aria-hidden />
										Publishing…
									</>
								) : (
									"Publish listing"
								)}
							</Button>
						)}
					</form.Subscribe>
				</CardFooter>
			</form>
		</Card>
	);
}

function FormSkeleton() {
	return (
		<Card aria-busy="true" aria-label="Loading form">
			<CardHeader>
				<Skeleton className="h-5 w-56" />
				<Skeleton className="h-3 w-44" />
			</CardHeader>
			<CardContent className="space-y-4">
				{["title", "price", "location", "category", "whatsapp"].map((key) => (
					<div key={key} className="space-y-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-8 w-full" />
					</div>
				))}
			</CardContent>
			<CardFooter>
				<Skeleton className="h-8 w-full" />
			</CardFooter>
		</Card>
	);
}
