/** Loads .env.local (if present) so scripts see the same settings as `next dev`. */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
