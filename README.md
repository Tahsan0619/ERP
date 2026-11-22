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
In Supabase Auth settings, disable "Confirm email" while developing so signup can bootstrap the company tenant immediately. If confirmation stays on, complete company setup after first login.

## What works today (honest scope)
You can sign up a company, manage basic masters, run sales/purchase documents with stock posting, post simple finance entries, run operational reports with CSV export, manage roles/permissions in-app, and use fiscal year locks for posting dates.

Not claimed as complete: advanced tax calculation on every line, invite/provision of staff from the UI, full permission enforcement on every screen action, native mobile apps, manufacturing, HR/payroll, banking integrations, or customer/vendor portals.

## Push sessions

### Stage 1 push
Completed in **37 minutes**.

- Started: 6:13 PM, 22 Nov 2026
- Ended: 6:50 PM, 22 Nov 2026

#### Added
- Product documentation set: `ERP`, `prd`, `scope`, `features`, `user-roles`, `workflows`, `tech`, `design`
- Initial README and `.gitignore`
- Design system notes and Stitch-oriented UI prompts in `docs/design.md`

#### Not included
- Application source code
- Database migrations
- Running ERP screens

---

### Stage 2 push
Completed in **26 minutes**.

- Started: 6:55 PM, 22 Nov 2026
- Ended: 7:21 PM, 22 Nov 2026

#### Added
- Vite React + TypeScript app under `web/`
- Supabase client wiring and env example
- Auth screens: sign in, sign up with tenant bootstrap RPC
- App shell with sidebar navigation and dashboard KPIs
- Masters CRUD screens: items, customers, vendors
- Draft create flows: sales orders, purchase orders
- Stock balance list, chart of accounts list, settings summary
- Initial MVP schema migration with tenant model, RLS baseline, bootstrap seed data (roles, warehouse, taxes, payment terms, number series, COA)

#### Limits in this stage
- Documents were mostly draft create/list
- No posting engine UI yet
- No reports, quotations, stock moves, or admin role matrix

---

### Stage 3 push
Completed in **12 minutes**.

- Started: 7:22 PM, 22 Nov 2026
- Ended: 7:34 PM, 22 Nov 2026

#### Added
- Posting RPCs: goods receipt, delivery note, sales invoice, purchase invoice, journal entry, receipt entry, payment entry
- Stock ledger updates through `apply_stock_move` on GRN and delivery
- Screens: goods receipts, delivery notes, sales invoices, purchase invoices, journals, receipts/payments
- Navigation for those operational flows

#### Limits in this stage
- Invoice posting mainly flipped status; full auto GL came later
- No quotations, stock transfer/adjustment UI, reports suite, or role matrix yet

---

### Stage 4 push
Completed in **20 minutes**.

- Started: 7:35 PM, 22 Nov 2026
- Ended: 7:55 PM, 22 Nov 2026

#### Operations and masters
- Quotations with convert-to-sales-order
- Sales order submit action (`draft` to `submitted`)
- Stock transfer and stock adjustment posting screens
- Org masters UI: tax templates, payment terms, UOM, warehouses
- Fiscal years UI with lock/unlock
- Credit notes and debit notes posting
- Password reset request and reset screens
- Audit log list
- Sales invoice print view
- Attachments panel on sales invoices (Supabase Storage bucket `attachments`)

#### Reports
- AR aging, AP aging
- Sales register, purchase register
- Stock balance report
- Trial balance
- Profit and loss and balance sheet views derived from posted journals
- CSV export for the active report tab

#### Finance posting upgrades
- Auto journal on sales invoice post (AR / Sales)
- Auto COGS journal on sales invoice post when item valuation rates produce a non-zero amount
- Auto journal on purchase invoice post (Expense / AP)
- Auto journals on customer receipts and vendor payments
- Sales invoice posting requires delivery progress (`partially_delivered` / `delivered`, or a posted delivery note)
- Credit note GL: Sales Dr / AR Cr
- Debit note GL: AP Dr / Expense Cr

#### Admin and security hardening
- Users and roles screen with role assignment and permission matrix toggles
- Permissions seed table and role-permission links
- Atomic document numbering RPC (`next_doc_number`)
- Profile/tenant setup gate when auth exists without a company profile
- Bootstrap seeds extra number series and an open fiscal year for new tenants
- RLS hardening for roles and number series (admin-gated writes)
- Tenant checks on sensitive definer helpers; direct client execute revoked for stock/journal helper RPCs
- Storage policies for tenant-scoped attachment paths

#### Migrations in this stage
- `202611220003_stage4_ops.sql`
- `202611220004_gl_fiscal_attachments.sql`
- `202611220005_security_numbering_fixes.sql`
- `202611220006_harden_definer_rpcs.sql`

#### Still open / partial
- Tax templates exist, but many create forms still post `tax_amount: 0` unless entered elsewhere
- Permission matrix is editable; not every screen button is gated by permission codes yet
- No in-app user invite/provision flow (profiles must already exist)
- Attachments UI is wired primarily on sales invoices
- Balance sheet retained-earnings line is computed in the report view, not a formal period-close process
- Manufacturing, HR/payroll, portals, 2FA, bank reconciliation are not built
