# BusinessOS ERP

Modular web ERP for mid-market trading, distribution, and light manufacturing.

## Required stack
- React + TypeScript
- Supabase (database and backend)

## Docs
- `docs/ERP.md` - product source summary
- `docs/prd.md` - product requirements
- `docs/scope.md` - in/out scope and phase cuts
- `docs/features.md` - feature inventory and priorities
- `docs/user-roles.md` - roles and permissions
- `docs/workflows.md` - end-to-end business flows
- `docs/tech.md` - technical direction (Supabase locked)
- `docs/design.md` - UI design system and Stitch-ready prompts

## App
Frontend lives in `web/`.

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Set in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

SQL migrations live in `supabase/migrations/`.

### First-run tip
In Supabase Auth settings, disable "Confirm email" while developing so signup can bootstrap the company tenant immediately.

## Push sessions

### Stage 1 push
Completed in **37 minutes**.

- Started: 6:13 PM, 22 Nov 2026
- Ended: 6:50 PM, 22 Nov 2026

### Stage 2 push
Completed in **26 minutes**.

- Started: 6:55 PM, 22 Nov 2026
- Ended: 7:21 PM, 22 Nov 2026

Stage 2 includes the locked React + TypeScript + Supabase app scaffold, MVP schema, auth/bootstrap, and core operational screens.

### Stage 3 push
Completed in **12 minutes**.

- Started: 7:22 PM, 22 Nov 2026
- Ended: 7:34 PM, 22 Nov 2026

Stage 3 includes posting RPCs (GRN, delivery, invoices, journals, receipts/payments), stock ledger updates, and the matching operational screens.
