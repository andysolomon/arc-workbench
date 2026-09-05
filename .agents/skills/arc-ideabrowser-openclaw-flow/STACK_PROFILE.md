# Scaffold Stack Profile

Load this when producing the scaffold spec.

## Default profile: `next-convex-clerk-shadcn`

- Framework: Next.js + TypeScript + shadcn/ui
- Data/Auth/Deploy: Convex + Clerk + Vercel
- TanStack: TanStack Query + TanStack Router
- Testing: Jest for Next.js, Playwright for e2e
- Syntax/shell: ESNext-first and zsh-compatible commands

## Optional profile: `postgres-sql-mode`

Use only when the user asks for SQL or the idea/repo context requires it.

- Database: PostgreSQL
- ORM: Drizzle preferred
- Avoid Prisma unless explicitly requested or already present

## Scaffold spec sections

Include:

- repo slug recommendation
- selected stack profile
- README summary block
- `IMPLEMENTATION_PLAN.md` phase outline
- `progress.txt` starter entries
- command checklist for scaffold, validate, git, and deploy

Commands are recommendations only unless the user explicitly approves execution.
