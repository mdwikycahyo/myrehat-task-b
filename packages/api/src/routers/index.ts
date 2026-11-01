import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { listingRouter } from "./listing";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  listing: listingRouter,
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
