# Product Requirements Document (PRD)

## 1. Document info
- Product: BusinessOS ERP
- Version: 1.0
- Status: Draft for build
- Source: ERP.md
- Audience: Product, engineering, design, founders

## 2. Summary
BusinessOS ERP is a modular web ERP for mid-market trading, distribution, and light manufacturing companies. It replaces fragmented tools with one connected system for customers, vendors, stock, money, people, and operational reporting.

## 3. Problem statement
Companies outgrow spreadsheets and disconnected apps. Common failure points:
1. Stock quantity wrong across locations
2. Sales orders fulfilled without reliable availability checks
3. Purchase costs not linked to inventory valuation
4. Invoices, payments, and ledger entries maintained separately
5. Approvals happen in chat with no system record
6. Month-end close is slow and error prone
7. Managers cannot see live sales, cash, and stock health

## 4. Goals
### Business goals
1. Reduce operational errors caused by duplicate data entry
2. Give owners a live view of sales, stock, payables, and receivables
3. Shorten order-to-cash and procure-to-pay cycle times
4. Create a clean audit trail for compliance and internal control
5. Enable phased rollout so companies can start small and expand

### Product goals
1. Deliver a usable MVP covering sales, purchase, inventory, and basic finance
2. Enforce role-based access across all modules
3. Keep every stock and money movement document-backed
4. Provide standard operational and financial reports from day one
5. Design modules so manufacturing, HR, and advanced finance can attach later

## 5. Non-goals (this PRD version)
1. Full MES or shop-floor IoT control
2. Advanced MRP with capacity planning
3. Public marketplace or ecommerce storefront
4. Native mobile apps in MVP (responsive web only)
5. Deep ERP localization for every country in first release
6. AI forecasting as a launch requirement

## 6. Users and jobs to be done
| Role | Main jobs |
|------|-----------|
| Owner / Director | Track revenue, margins, cash, stock risk, and team performance |
| Sales Manager | Manage customers, quotations, orders, delivery, and collections follow-up |
| Purchase Officer | Raise PRs/POs, compare vendors, track receipts and bills |
| Warehouse Staff | Receive, issue, transfer, adjust, and count stock accurately |
| Accountant | Post journals, manage AR/AP, bank, tax, and period close |
| HR Officer | Maintain employees, attendance, leave, and payroll basics |
| Admin | Configure company, users, roles, masters, and numbering |

## 7. Success metrics
1. Time to create sales order under 2 minutes for trained users
2. Stock accuracy above 98% after cycle-count adoption
3. Invoice to ledger posting with zero double entry for standard flows
4. Month-end close reduced versus baseline spreadsheet process
5. Less than 5 critical severity defects in first production month
6. At least 80% of daily operations done inside the ERP, not side tools

## 8. Product scope overview
### In scope for product direction
1. Multi-company or multi-branch ready data model
2. Multi-warehouse inventory
3. Sales CRM lite plus order management
4. Purchasing and vendor management
5. Inventory movements and valuation basics
6. Finance: chart of accounts, AR, AP, banking, journals, tax hooks
7. HR basics and payroll basics
8. Dashboards, operational reports, export
9. Audit logs, approvals, document numbering, attachments

### Out of scope for early product
1. Advanced production scheduling
2. Field service management suite
3. Full WMS robotics automation
4. Customer self-service portal (Phase 3 candidate)
5. Vendor portal (Phase 3 candidate)

## 9. Module requirements

### 9.1 Identity and access
1. Email/password login with secure session handling
2. Password reset and forced password change support
3. Role-based permissions at module and action level
4. User invite, activate, deactivate
5. Session timeout and login history
6. Optional 2FA in later phase

### 9.2 Organization and masters
1. Company profile and fiscal year setup
2. Branches and warehouses
3. Currencies and exchange rate entry
4. Tax templates and tax groups
5. Payment terms, price lists, uom, item groups
6. Number series per document type
7. Document print templates basics

### 9.3 CRM and sales
1. Customer master with contacts and credit limit
2. Lead and opportunity lite tracking
3. Quotation create, revise, convert
4. Sales order with item, qty, rate, tax, discount
5. Delivery note / goods issue against sales order
6. Sales invoice and credit note
7. Customer statement and outstanding aging
8. Sales returns flow

### 9.4 Purchasing and vendors
1. Vendor master with contacts and payment terms
2. Material request / purchase requisition
3. Request for quotation (optional in Phase 2)
4. Purchase order create, approve, amend
5. Goods receipt note against PO
6. Purchase invoice / bill and debit note
7. Vendor outstanding and aging
8. Purchase returns flow

### 9.5 Inventory and warehouses
1. Item master: goods, service, and stock flags
2. Multi-warehouse stock balances
3. Batches and serials as optional item settings
4. Stock entry types: receipt, issue, transfer, adjustment
5. Reorder level and low stock alerts
6. Stock valuation method support (moving average first)
7. Stock ledger and item-wise movement history
8. Cycle count / stock reconciliation

### 9.6 Manufacturing light
1. Bill of materials (BOM)
2. Production order against BOM
3. Material consumption and finished goods receipt
4. Basic production cost rollup
5. Not included: finite capacity scheduling, machine centers, real-time shop floor

### 9.7 Finance and accounting
1. Chart of accounts
2. Manual journal entries with approval option
3. Accounts receivable from sales invoices and receipts
4. Accounts payable from purchase invoices and payments
5. Payment entry and receipt entry
6. Bank accounts and basic reconciliation
7. Tax summary reports
8. Trial balance, P&L, balance sheet
9. Period lock and fiscal year close controls
10. Cost centers optional tagging

### 9.8 HR and payroll
1. Employee master
2. Departments and designations
3. Attendance entry or import
4. Leave types and leave requests
5. Salary structure and payroll run basics
6. Payslip generation
7. Statutory deductions as configurable components
8. Employee self-service deferred to later phase

### 9.9 Reporting and dashboards
1. Executive dashboard: sales, purchases, stock value, cash position
2. Sales register, purchase register
3. Stock balance and stock movement reports
4. AR/AP aging
5. Tax reports
6. Payroll summary
7. CSV/Excel export on major reports
8. Saved filters per user

### 9.10 System settings and audit
1. Company settings and branding for documents
2. Role and permission matrix UI
3. Approval rules for selected documents
4. Attachment upload on documents
5. Full audit log: who changed what and when
6. Notification center for approvals and low stock
7. Data backup and restore process (ops owned)

## 10. Cross-cutting requirements
1. All money and stock documents must be immutable after posting, with reversal or amendment patterns
2. Permissions checked on every read and write API
3. Soft delete or archive for masters where historically referenced
4. Search and filter on all major list screens
5. Responsive layout for laptop and tablet first
6. Localization-ready labels and date/number formats
7. Idempotent posting for financial and inventory documents

## 11. Release phases
### Phase 1 MVP
Identity, masters, sales orders to invoice, purchase orders to bill, inventory core, basic finance (AR/AP/journals/reports), audit, roles.

### Phase 2
Approvals engine hardening, batches/serials, bank reconciliation, manufacturing light, HR attendance and leave, richer dashboards.

### Phase 3
Payroll maturity, portals, multi-company consolidation, 2FA, advanced analytics, deeper banking integrations.

## 12. Assumptions
1. Customers have stable internet for web usage
2. Initial deployments are single-country tax setups, with tax engine kept configurable
3. Accounting follows standard double-entry principles
4. Moving average valuation is acceptable for MVP
5. One primary admin exists per tenant at go-live

## 13. Risks and mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep across ERP modules | High | Strict phase gates and MVP cut list |
| Inventory valuation edge cases | High | Start with one valuation method and clear docs |
| Permission mistakes expose data | Critical | Default deny, role templates, audit reviews |
| Poor UX slows adoption | High | Optimize daily task screens first |
| Tax complexity by market | Medium | Configurable tax templates, avoid hardcoding |

## 14. Dependencies
1. Auth and tenancy foundation before module screens
2. Item, warehouse, customer, vendor masters before transactional docs
3. Posting engine for stock and ledger before finance go-live
4. Report layer after core transactions stabilize

## 15. Acceptance criteria for PRD completeness
1. Every MVP module has listed capabilities
2. In-scope and out-of-scope are explicit
3. Roles and major workflows are documented in companion files
4. Feature IDs exist in features.md for build tracking
5. Phase boundaries are clear enough for sprint planning

## 16. Companion documents
1. ERP.md: product source summary
2. scope.md: hard boundaries and MVP cut
3. features.md: feature inventory and priorities
4. user-roles.md: roles and permissions
5. workflows.md: end-to-end process flows
6. tech.md: technical direction and non-functional requirements
7. design.md: UI design system, tokens, screens, and Stitch prompts
