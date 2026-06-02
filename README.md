# YKS Mentor — MVP

Quick starter for the YKS Mentor MVP (Vite + React + TypeScript + Tailwind + Supabase).

Getting started:

1. Install dependencies

```bash
npm install
```

2. Create `.env` (see `.env.example`) and add your Supabase keys as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

   Example `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Run SQL in Supabase: use `sql/schema.sql` to create `profiles`, `tasks`, `performance`, and `meetings` tables plus auth triggers/functions.

   Optionally run `sql/seed.sql` if you want the prepared sample users.

4. Run dev server

```bash
npm run dev
```
