# Technical Direction

## 1. Purpose
Capture the locked technical approach and non-functional requirements for BusinessOS ERP.

## 2. Required technology (mandatory)
These are required. Do not substitute.

| Layer | Required choice | Notes |
|-------|-----------------|-------|
| Frontend | React + TypeScript | Vite SPA |
| Backend and database | Supabase | Postgres, Auth, Storage, Row Level Security, Edge Functions when needed |

### Stack rules
1. React + TypeScript is mandatory for the UI
2. Supabase is mandatory for database and backend services
3. Do not introduce a separate NestJS/.NET/Express primary backend unless a rare edge case needs an Edge Function or worker
4. Business data lives in Supabase Postgres
5. Auth uses Supabase Auth
6. File attachments use Supabase Storage
7. Access control uses Supabase RLS plus app role checks

## 3. Architecture principles
1. Modular frontend with clear module folders
2. Tenant-aware data model from day one
3. Document posting rules enforced in Postgres functions/transactions where critical
4. Permission checks via RLS and role tables
5. Prefer Supabase primitives over custom servers
6. Auditability over silent side effects
7. No secrets in git (use `.env` locally only)

## 4. Locked implementation stack
| Layer | Choice |
|-------|--------|
| UI | React + TypeScript (Vite) |
| Routing | React Router |
| Styling | CSS variables from design.md (Operational Clear) |
| Backend | Supabase |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage |
| Client SDK | `@supabase/supabase-js` |
| Hosting (app) | Vite static host / any SPA host |
| Hosting (data) | Supabase project |

## 5. High-level system shape
1. React web client
2. Supabase Auth session
3. Supabase Postgres domain tables
4. RLS policies per tenant/role
5. Shared kernel tables: identity mapping, tenancy, numbering, attachments, audit
6. Domain modules: sales, purchase, inventory, finance, admin (HR later)
7. Supabase Storage for attachments and generated PDFs
8. Optional Edge Functions for heavy posting or exports later

## 6. Multi-tenancy
1. Every business record includes `tenant_id`
2. All queries are tenant-scoped
3. RLS blocks cross-tenant reads/writes
4. Bootstrap admin exists per tenant
5. Shared Supabase project with row isolation first

## 7. Core domain objects (logical)
1. User profile, Role, Permission
2. Company, Branch, Warehouse
3. Item, UOM, Item Group
4. Customer, Vendor
5. Quotation, Sales Order, Delivery Note, Sales Invoice, Credit Note
6. Purchase Order, GRN, Purchase Invoice, Debit Note
7. Stock Ledger Entry, Stock Balance
8. Account, Journal Entry, Payment Entry, Receipt Entry
9. Employee, Attendance, Leave, Payroll Run (later)
10. Audit Event, Attachment, Notification

## 8. Posting engine requirements
1. Draft -> Submitted/Posted state machine
2. Posted documents immutable
3. Reverse or amend creates linked compensating documents
4. Inventory and GL postings happen in one DB transaction where required
5. Idempotent submit operations
6. Strong validation before post (balances, stock qty, permissions, period open)
7. Prefer Postgres functions/RPCs for multi-table posting

## 9. API approach on Supabase
1. Primary data access through Supabase client (table queries and RPCs)
2. Consistent filters: date, status, party, warehouse, text search
3. Pagination on all list queries
4. Clear DB/RPC error mapping in the UI
5. Edge Functions only when client-side or RLS alone is insufficient
6. External webhooks deferred to Phase 3

## 10. Non-functional requirements
| Area | Target |
|------|--------|
| Availability | Rely on Supabase project SLA plus app host |
| API p95 latency | Under 500 ms for standard CRUD |
| Report p95 | Under 5 s for common operational reports |
| Security | Supabase Auth, RLS, role tables, audit logs |
| Backup | Supabase backups plus export routines |
| Scalability | Support 50 concurrent users per tenant initially |
| Data retention | Soft-delete/archive masters; retain financial docs per policy |
| Accessibility | Keyboard usable core forms, readable contrast |
| Browser support | Latest Chrome, Edge, Firefox; Safari current |

## 11. Security requirements
1. Use Supabase Auth password hashing (do not roll custom auth)
2. Least-privilege roles with RLS
3. Publishable key only in the web client
4. Service role key never in the frontend or git
5. Attachment type/size limits
6. No secrets in source control (`supabasecreds.md`, `.env` ignored)
7. Admin actions fully audited
8. 2FA in Phase 3

## 12. Data and valuation rules (MVP)
1. Moving average valuation for stock items
2. Service items do not create stock ledger rows
3. Tax calculated at document line/header according to template
4. Foreign currency allowed with exchange rate on document date
5. Rounding rules documented and consistent across modules

## 13. Integration direction
### MVP
1. CSV import for opening customers, vendors, items, opening stock
2. CSV/Excel export for reports

### Later
1. Banking statement import
2. Email gateway for documents and alerts
3. SMS/WhatsApp notifications optional
4. E-invoice statutory adapters by country pack

## 14. Environments
1. Local development against the Supabase project
2. Staging project or separate schemas later if needed
3. Production Supabase project
4. Separate env files per machine/environment
5. SQL migrations versioned in `supabase/migrations`

## 15. Testing strategy
1. Unit tests for tax, valuation helpers, permission helpers
2. Integration tests against Supabase for order-to-cash and procure-to-pay
3. End-to-end smoke tests for login and core docs
4. Regression pack before period-close related releases

## 16. Observability
1. Frontend error boundary + logging
2. Supabase logs for Auth, DB, Storage
3. Audit trail table separate from debug logs

## 17. Delivery plan alignment
| Phase | Technical focus |
|-------|-----------------|
| Phase 1 MVP | Auth, tenancy, masters, sales, purchase, inventory, finance posting, reports on React + Supabase |
| Phase 2 | Approvals, batches/serials, bank recon, manufacturing light, HR core |
| Phase 3 | Payroll jobs, portals, consolidation, 2FA, bank APIs, analytics |

## 18. Open decisions (non-stack)
1. Exact attachment scanning toolchain
2. Whether Edge Functions are required in MVP posting paths
3. SPA host provider (Vercel/Netlify/static host)

## 19. Acceptance criteria
1. Stack is React + TypeScript + Supabase only for core product paths
2. Tenant isolation proven by RLS tests
3. Posting integrity proven for sales and purchase flows
4. No service-role or access tokens committed to git
