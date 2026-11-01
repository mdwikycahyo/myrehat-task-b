import { createAuth } from "@myrehat-task-b/auth";
import { createDb } from "@myrehat-task-b/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
