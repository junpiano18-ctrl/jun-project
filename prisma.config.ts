import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Supabase 사용 시:
//   - DIRECT_URL  : 마이그레이션·introspection용 (5432, 직결)
//   - DATABASE_URL: 앱 런타임 (6543, pooler/supavisor) — src/lib/db.ts에서 사용
//
// Prisma 7부터 schema 내 url/directUrl 필드가 제거되어 여기서 관리한다.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
