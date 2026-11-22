# Technical Direction

## 1. Purpose
Capture technical approach and non-functional requirements for BusinessOS ERP. This is direction, not a final architecture freeze.

## 2. Architecture principles
1. Modular monolith first, with clear module boundaries
2. Tenant-aware data model from day one
3. Document posting engine shared by inventory and finance
4. Permission checks on every API
5. Prefer simple reliable patterns over premature microservices
6. Auditability over silent side effects

## 3. Recommended stack (default proposal)
| Layer | Proposal | Notes |
|-------|----------|-------|
| Frontend | React + TypeScript | Responsive web app |
| Backend API | Node.js (NestJS) or .NET API | Choose one and stay consistent |
| Database | PostgreSQL | Relational source of truth |
| Cache/session | Redis | Sessions, short-lived locks, queues later |
| File storage | S3-compatible object storage | Attachments and PDFs |
| Auth | JWT/session cookies + RBAC | Secure HTTP-only cookies preferred for web |
| PDF/export | Server-side generators | Invoices, POs, reports |
| Hosting | Containerized web + API + DB | Single-region first |

Final stack choice should be locked before sprint 1 coding.

## 4. High-level system shape
1. Web client
2. API gateway / API app
3. Domain modules: sales, purchase, inventory, finance, HR, admin
4. Shared kernel: identity, tenancy, numbering, attachments, audit, notifications
5. PostgreSQL primary datastore
6. Object storage for files
7. Background worker for emails, heavy reports, payroll jobs later

## 5. Multi-tenancy
1. Every business record includes tenant_id
2. All queries are tenant-scoped
3. Cross-tenant access is impossible through normal APIs
4. Bootstrap admin exists per tenant
5. Shared app, isolated data rows first; dedicated DB per tenant later if needed

## 6. Core domain objects (logical)
1. User, Role, Permission
2. Company, Branch, Warehouse
3. Item, UOM, Item Group
4. Customer, Vendor
5. Quotation, Sales Order, Delivery Note, Sales Invoice, Credit Note
6. Purchase Order, GRN, Purchase Invoice, Debit Note
7. Stock Ledger Entry, Stock Balance
8. Account, Journal Entry, Payment Entry, Receipt Entry
9. Employee, Attendance, Leave, Payroll Run (later)
10. Audit Event, Attachment, Notification

## 7. Posting engine requirements
1. Draft -> Submitted/Posted state machine
2. Posted documents immutable
3. Reverse or amend creates linked compensating documents
4. Inventory and GL postings happen in one transactional unit where required
5. Idempotent submit operations
6. Strong validation before post (balances, stock qty, permissions, period open)

## 8. API requirements
1. Versioned REST APIs first
2. Consistent list filters: date, status, party, warehouse, text search
3. Pagination on all list endpoints
4. Clear error codes for permission, validation, conflict, period lock
5. OpenAPI documentation maintained
6. Webhooks deferred to Phase 3 unless a must-have integration appears

## 9. Non-functional requirements
| Area | Target |
|------|--------|
| Availability | 99.5% monthly for MVP hosting |
| API p95 latency | Under 500 ms for standard CRUD |
| Report p95 | Under 5 s for common operational reports |
| Security | RBAC, TLS, password hashing, audit logs |
| Backup | Daily automated DB backups, tested restore |
| Scalability | Support 50 concurrent users per tenant initially |
| Data retention | Soft-delete/archive masters; retain financial docs per policy |
| Accessibility | Keyboard usable core forms, readable contrast |
| Browser support | Latest Chrome, Edge, Firefox; Safari current |

## 10. Security requirements
1. Hash passwords with a modern algorithm (bcrypt/argon2)
2. Least-privilege roles
3. CSRF protections if cookie sessions used
4. Rate-limit auth endpoints
5. Attachment type/size limits and malware scanning plan
6. No secrets in source control
7. Admin actions fully audited
8. 2FA in Phase 3

## 11. Data and valuation rules (MVP)
1. Moving average valuation for stock items
2. Service items do not create stock ledger rows
3. Tax calculated at document line/header according to template
4. Foreign currency allowed with exchange rate on document date
5. Rounding rules documented and consistent across modules

## 12. Integration direction
### MVP
1. CSV import for opening customers, vendors, items, opening stock
2. CSV/Excel export for reports

### Later
1. Banking statement import
2. Email gateway for documents and alerts
3. Accounting export adapters if customers keep external GL temporarily
4. SMS/WhatsApp notifications optional
5. E-invoice statutory adapters by country pack

## 13. Environments
1. Local development
2. Staging
3. Production
4. Separate secrets and databases per environment
5. Migration scripts required for every schema change

## 14. Testing strategy
1. Unit tests for posting, tax, valuation, permissions
2. Integration tests for order-to-cash and procure-to-pay
3. End-to-end smoke tests for login and core docs
4. Regression pack before period-close related releases
5. Load smoke for list and post endpoints before go-live

## 15. Observability
1. Structured application logs
2. Error tracking
3. Metrics for API latency and queue lag
4. Audit trail separate from debug logs
5. Health checks for API and worker

## 16. Delivery plan alignment
| Phase | Technical focus |
|-------|-----------------|
| Phase 1 MVP | Auth, tenancy, masters, sales, purchase, inventory, finance posting, reports |
| Phase 2 | Approvals, batches/serials, bank recon, manufacturing light, HR core |
| Phase 3 | Payroll jobs, portals, consolidation, 2FA, bank APIs, analytics |

## 17. Open technical decisions
1. NestJS vs .NET for API
2. Monorepo vs separate frontend/backend repos
3. SSR vs SPA hosting model
4. Exact attachment scanning toolchain
5. Whether background worker is required in MVP or can wait for Phase 2

## 18. Acceptance criteria
1. Stack choice documented before feature coding starts
2. Tenant isolation proven by automated tests
3. Posting engine transactional integrity proven for sales and purchase flows
4. Backup and restore rehearsed once before production launch
