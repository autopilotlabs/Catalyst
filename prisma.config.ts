import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (higher priority), then fallback to .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

