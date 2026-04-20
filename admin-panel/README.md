# admin-panel

```bash
cp .env.example .env && npx prisma migrate dev && npm run dev
```

Stack: Next.js App Router · Prisma · PostgreSQL · Zod · Vitest · RBAC

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
