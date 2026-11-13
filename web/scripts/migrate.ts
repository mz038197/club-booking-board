/** npm run db:migrate — applies db/migrations to DATABASE_URL. */
import "./load-env";
import { dbFromEnv } from "../src/server/db";
import { migrate } from "../src/server/db/migrate";

const db = await dbFromEnv(process.env);
try {
  const ran = await migrate(db);
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
} finally {
  await db.close();
}
