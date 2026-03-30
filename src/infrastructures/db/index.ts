import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.ts";

// oxlint-disable-next-line typescript/no-non-null-assertion -- 環境変数は起動時に必須
export const db = drizzle(process.env.DATABASE_URL!, { schema });
