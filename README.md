# Node.js / Next.js Level 1 Assessment

Admin-panel feature set on Next.js App Router with Prisma, PostgreSQL, Zod, Vitest, and RBAC.

## Run

```bash
cd admin-panel && cp .env.example .env && npx prisma migrate dev && npm run dev
```

## Routes (after `npm run dev`)

- http://localhost:3000/admin — redirects to `/admin/announcements`
- http://localhost:3000/admin/announcements — list (non-deleted, paginated)
- http://localhost:3000/admin/announcements/new — bilingual create form
- http://localhost:3000/admin/announcements/[id]/edit — edit + soft-delete
- http://localhost:3000/admin/users — user lookup (SUPPORT: 4 cols, ADMIN: 7)
- http://localhost:3000/api/health — `{ status: "ok" }`
- http://localhost:3000/api/health?include=latest — latest announcement or `{ latest: null }`
- http://localhost:3000/api/announcements — `POST` create
- http://localhost:3000/api/announcements/[id] — `PATCH` / `DELETE`
- http://localhost:3000/api/users — `GET` with `?q=&page=&pageSize=`
