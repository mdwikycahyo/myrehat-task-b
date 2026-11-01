import type { Session } from "@myrehat-task-b/auth";
import type { Database } from "@myrehat-task-b/db";

export type Context = {
  session: Session | null;
  db: Database;
};
