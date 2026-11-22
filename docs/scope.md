# Scope Document

## 1. Purpose
This file defines hard boundaries for BusinessOS ERP. Use it to prevent scope creep during design and build.

## 2. Product boundary
BusinessOS ERP covers internal company operations for sales, purchasing, inventory, finance, light manufacturing, HR basics, and reporting. It is not an ecommerce platform, MES, or full WMS robotics suite.

## 3. In scope
### Business capabilities
1. Multi-branch and multi-warehouse operations
2. Customer and vendor lifecycle masters
3. Quotation to sales invoice cycle
4. Purchase requisition to purchase bill cycle
5. Stock receipt, issue, transfer, adjustment, and counting
6. Double-entry accounting with AR, AP, journals, and financial statements
7. Basic BOM and production order flow
8. Employee records, attendance, leave, and basic payroll
9. Role-based access, approvals, attachments, and audit logs
10. Operational and financial reporting with export

### Technical capabilities
1. Web application with responsive UI
2. Tenant-ready data separation model
3. Secure authentication and authorization
4. Document numbering and posting controls
5. Search, filter, pagination on major lists
6. File attachments on key documents
7. Configurable tax templates and payment terms
8. API layer suitable for future integrations

## 4. Out of scope
1. Native iOS/Android apps in early phases
2. Public customer storefront / cart checkout
3. Marketplace seller tools
4. Advanced MRP and capacity planning
5. Machine IoT / SCADA integrations
6. Robotics or conveyor-driven WMS automation
7. Full project accounting suite
8. Legal case management
9. Full CRM marketing automation
10. AI demand forecasting as a launch feature
11. Multi-country statutory packs all at once
12. Custom report designer in MVP
13. Real-time collaborative spreadsheet editing
14. Cryptocurrency ledgers
15. Point-of-sale hardware certification suite

## 5. MVP scope (Phase 1)
### Included
1. Login, users, roles, permissions
2. Company, branch, warehouse, fiscal year
3. Item, customer, vendor masters
4. UOM, item groups, tax templates, payment terms, number series
5. Sales quotation, sales order, delivery note, sales invoice, credit note
6. Purchase order, goods receipt, purchase invoice, debit note
7. Stock balances, stock ledger, transfer, adjustment, low stock view
8. Chart of accounts, payment/receipt entries, manual journals
9. AR aging, AP aging, stock reports, sales/purchase registers
10. Trial balance, P&L, balance sheet (basic)
11. Audit log and document attachments
12. CSV/Excel export on core reports

### Explicitly excluded from MVP
1. Manufacturing light
2. Batches and serial numbers
3. Bank reconciliation UI
4. Advanced approval matrix (simple approve/reject only if needed)
5. HR attendance, leave, payroll
6. Lead/opportunity pipeline beyond basic customer notes
7. RFQ multi-vendor comparison
8. Customer/vendor portals
9. 2FA
10. Multi-company consolidated statements

## 6. Phase 2 scope
1. Approval rules engine for PO, quotation discounts, journal, leave
2. Batches and serial tracking
3. Bank reconciliation
4. Manufacturing light: BOM, production order, consumption, FG receipt
5. HR: employees, attendance, leave
6. Dashboard widgets expansion
7. Cost center tagging
8. Notification center improvements

## 7. Phase 3 scope
1. Payroll run maturity and statutory component packs
2. Employee self-service basics
3. Customer portal for invoices and statements
4. Vendor portal for PO and ASN lite
5. Multi-company consolidation
6. 2FA and advanced security controls
7. Banking integrations
8. Advanced analytics and custom saved report packs

## 8. Scope by module matrix
| Module | MVP | Phase 2 | Phase 3 |
|--------|-----|---------|---------|
| Identity and access | Yes | Hardening + notifications | 2FA |
| Organization and masters | Yes | Cost centers | Multi-company packs |
| CRM and sales | Core docs | Lead lite polish | Customer portal |
| Purchasing | Core docs | RFQ | Vendor portal |
| Inventory | Core stock | Batches/serials | Advanced WMS rules |
| Manufacturing light | No | Yes | Scheduling lite later |
| Finance | Core AR/AP/GL | Bank recon | Consolidation + bank APIs |
| HR and payroll | No | HR core | Payroll maturity |
| Reporting | Core reports | Dashboards | Analytics |
| Audit and settings | Yes | Approvals engine | Security upgrades |

## 9. Non-goals that stay non-goals unless product revises this file
1. Replacing specialized MES systems
2. Replacing full CRM suites like enterprise marketing clouds
3. Becoming an ecommerce OMS for high-volume D2C brands first

## 10. Change control
1. Any new feature request must map to a feature ID in features.md
2. MVP changes require explicit update to this file and prd.md
3. If a request is Phase 2/3, keep it listed but do not pull into current sprint unless phase plan changes
4. "Nice to have" is not in scope until prioritized as P0/P1

## 11. Definition of done for scope clarity
1. Team can answer "is this in MVP?" in one check against Section 5
2. Engineering can plan Phase 1 without manufacturing or payroll dependencies
3. Sales/demo scripts only promise MVP capabilities for first release
