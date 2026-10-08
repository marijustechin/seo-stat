import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The database URL is required for generate/migrate. A placeholder keeps
// `prisma generate` working in environments without a database (for example
// typecheck and CI before a database is attached); real deployments always
// provide DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
