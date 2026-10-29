import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(projectRoot, ".env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(projectRoot, "apps", "api", ".env") });
}

export default defineConfig({
  schema: "packages/db/prisma/schema.prisma",
  migrations: {
    path: "packages/db/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});