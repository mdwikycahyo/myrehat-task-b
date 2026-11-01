import { bigint, index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { LISTING_CATEGORIES } from "../listing";
import { user } from "./auth";

export const listingCategory = pgEnum("listing_category", LISTING_CATEGORIES);

export const listing = pgTable(
  "listing",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    // bigint (mode "number"): whole IDR amounts exceed int4's ~2.1B limit; JS numbers are exact up to 2^53-1.
    price: bigint("price", { mode: "number" }).notNull(),
    location: text("location").notNull(),
    category: listingCategory("category").notNull(),
    whatsapp: text("whatsapp").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("listing_userId_idx").on(table.userId)],
);
