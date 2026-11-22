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

### Demo Owner account
- Email: `erp@gmail.com`
- Password: `erp06190`
- Roles: Owner + Admin (all permission codes)
- Seeded masters: sample customer, vendor, items, opening stock

## What works today (honest scope)
You can sign up a company, invite users by link (with revoke), manage masters, run sales/purchase with tax on quotations/SO/PO/invoices, post stock and finance documents with permission-gated actions and nav, run reports with CSV export, close fiscal years by wiping P&L into equity account 3000, attach files across major documents, run light manufacturing and basic HR/payroll, reconcile bank lines via amount-checked RPC, use a same-app customer/vendor portal view, and enroll plus challenge TOTP 2FA at login (requires MFA enabled in Supabase Auth).

Still partial / constrained:
- Portal is same-app read-only party views, not a separate public portal product
- 2FA depends on Supabase project MFA being turned on
- Payroll is a simple one-employee net-pay post, not a full statutory payroll suite
- Manufacturing is BOM + stock moves only (no full WIP costing)
- Native mobile apps are not built

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

---

### Stage 5 push
Completed in **57 minutes**.

- Started: 7:56 PM, 22 Nov 2026
- Ended: 8:53 PM, 22 Nov 2026

#### Closed Stage 4 open / partial items
- Tax templates on quotations, sales orders, purchase orders, and sales/purchase invoices (`tax_amount` / `grand_total` computed; invoice GL splits tax to 2200 / 1400)
- Permission gating via `usePermissions` on create/post/export actions; AppShell nav filtered by permission codes
- In-app invite flow: `create_invite` / `accept_invite` / `revoke_invite`, pending invite list on Users and roles
- Attachments on quotations, orders, deliveries, GRNs, invoices, credit/debit notes, journals, receipts/payments
- Formal period close: `close_fiscal_year` zeroes P&L into equity 3000 and locks the year; balance sheet stops synthetic RE after a closed year
- Manufacturing light (BOM + production post), HR basics (employees, attendance, leave, payroll post), bank recon (`reconcile_bank_line`), same-app portal party link, TOTP 2FA enroll + login MFA challenge

#### Reliability and ops hardening
- Fixed profiles RLS recursion that blocked login after auth (`current_tenant_id` security definer)
- Clearer stock errors (SKU / warehouse / available qty); delivery pre-checks stock before post
- Collision-safe `next_doc_number` with series sync
- Shared `errorMessage` helper so RPC errors surface in the UI
- Auth profile-load race fixed (no false “Finish company setup” / hung “Loading session”)
- Demo Owner account seeded for end-to-end use (`erp@gmail.com`)
- Flow audit script: `scripts/erp-flow-audit.mjs` (22 flows, PASS)

#### UI / design-system alignment
- Split login layout matching Stitch Operational Clear mockups
- Grouped sidebar modules + richer topbar (search, warehouse chip, avatar)
- Executive dashboard KPIs from live data

#### Print / PDF
- Printable document views for sales/purchase invoices, quotations, SO/PO, deliveries, GRNs, credit/debit notes, receipts/payments, journals
- Per-row **PDF** actions open print view → browser “Save as PDF”

#### Migrations in this stage
- `202611220007_remaining_gaps.sql`
- `202611220008_permissions_close_tax_bank.sql`
- `202611220009_fix_profiles_rls_recursion.sql`
- `202611220010_ops_hardening.sql`
- `202611220011_number_series_sync.sql`

#### Limits still honest
- Portal is same-app, not a separate public portal product
- Payroll / manufacturing remain light implementations
- PDF is print-to-PDF (no server-side PDF binary generator)
- Native mobile apps are not built
