import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Required only for migrate commands, not for prisma generate
    url: process.env.DATABASE_URL ?? "",
  },
});
