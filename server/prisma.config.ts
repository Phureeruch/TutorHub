import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Restrict dummy fallback DATABASE_URL strictly to client generation (`prisma generate`),
// allowing offline/container builds to succeed while ensuring migration and database
// operations fail immediately if DATABASE_URL is missing.
const isGenerateCommand = process.argv.some(
  (arg) => arg === "generate" || arg.endsWith("generate"),
);

if (!process.env.DATABASE_URL && isGenerateCommand) {
  process.env.DATABASE_URL =
    "postgresql://placeholder:placeholder@localhost:5432/placeholder";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});