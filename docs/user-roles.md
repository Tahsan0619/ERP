# User Roles and Permissions

## 1. Purpose
Define who uses BusinessOS ERP and what each role can do. Permissions are default-deny unless granted.

## 2. Role list
| Role code | Role name | Typical users | Phase |
|-----------|-----------|---------------|-------|
| R-OWNER | Owner / Director | Founders, managing directors | MVP |
| R-ADMIN | System Administrator | IT/admin operator | MVP |
| R-SALES | Sales User | Sales executives | MVP |
| R-SALES-MGR | Sales Manager | Sales leads | MVP |
| R-PURCHASE | Purchase User | Procurement staff | MVP |
| R-PURCHASE-MGR | Purchase Manager | Procurement lead | MVP |
| R-WAREHOUSE | Warehouse User | Store keepers | MVP |
| R-WAREHOUSE-MGR | Warehouse Manager | Inventory lead | MVP |
| R-ACCOUNTANT | Accountant | Finance executives | MVP |
| R-FIN-CTRL | Finance Controller | Finance manager | MVP |
| R-HR | HR Officer | HR staff | Phase 2 |
| R-PAYROLL | Payroll Officer | Payroll staff | Phase 3 |
| R-EMP-SELF | Employee Self-Service | All employees | Phase 3 |
| R-AUDIT | Auditor (read-only) | Internal/external auditors | Phase 2 |

## 3. Permission model
### Permission shape
`module.entity.action`

### Common actions
1. view
2. create
3. edit
4. delete
5. submit
6. cancel
7. approve
8. post
9. export
10. print

### Rules
1. Posted financial and stock documents are not freely editable
2. Delete on transactional docs is usually replaced by cancel/amend/reverse
3. Export and print still require view permission
4. A user may hold multiple roles; permissions are unioned
5. Branch/warehouse data scope can further restrict visible records

## 4. Role summaries

### Owner / Director
1. View all dashboards and reports
2. View all modules in read mode by default
3. Approve high-value exceptions if configured
4. No day-to-day warehouse posting required
5. Can access company settings in small tenants if also admin

### System Administrator
1. Manage users, roles, permissions
2. Manage numbering, tax templates, and masters setup
3. Configure company/branch/warehouse
4. View audit logs
5. Should not post financial documents in production unless dual-role assigned

### Sales User
1. Manage assigned customers
2. Create quotations, sales orders, delivery notes, invoices as permitted
3. View stock availability
4. View customer outstanding
5. Cannot change tax masters or COA

### Sales Manager
1. All Sales User capabilities
2. View team sales reports
3. Approve discount exceptions
4. Credit limit override with policy
5. Cancel or amend sales documents per policy

### Purchase User
1. Manage vendors used in buying
2. Create POs and related purchase docs
3. View item requirements and stock
4. Cannot approve own high-value PO if dual-control enabled

### Purchase Manager
1. All Purchase User capabilities
2. Approve purchase orders
3. Vendor performance visibility
4. Amend/cancel purchase docs per policy

### Warehouse User
1. Create goods receipts, delivery notes, transfers, adjustments
2. View stock balances and ledgers
3. Perform cycle counts
4. Cannot edit unit prices or financial masters

### Warehouse Manager
1. All Warehouse User capabilities
2. Approve adjustments above threshold
3. Manage reorder levels
4. Oversee multi-warehouse transfers

### Accountant
1. Create payment/receipt entries and journals
2. Manage AR/AP matching
3. Run financial reports
4. Cannot unlock closed periods

### Finance Controller
1. All Accountant capabilities
2. Manage COA and period locks
3. Approve journals if required
4. Oversee tax reports and close process
5. Configure finance-related settings

### HR Officer
1. Manage employees, departments, designations
2. Capture attendance and leave
3. Cannot run final payroll unless also payroll role

### Payroll Officer
1. Maintain salary structures
2. Run payroll and generate payslips
3. Export payroll summaries to finance
4. No unrestricted employee personal data export beyond need

### Employee Self-Service
1. View own profile subset
2. Apply leave
3. View own payslips
4. No access to other employee data

### Auditor
1. Read-only access across financial and inventory records
2. View audit logs
3. Export reports
4. No create/edit/post rights

## 5. Module permission matrix (MVP)
Legend: F = full operational access, L = limited/own or assigned, V = view, A = approve, N = none

| Area | Owner | Admin | Sales | Sales Mgr | Purchase | Purchase Mgr | Warehouse | Warehouse Mgr | Accountant | Fin Ctrl |
|------|-------|-------|-------|-----------|----------|--------------|-----------|---------------|------------|----------|
| Users and roles | V | F | N | N | N | N | N | N | N | V |
| Masters setup | V | F | V | V | V | V | V | V | V | F |
| Customers | V | V | L/F | F | V | V | V | V | V | V |
| Sales documents | V | V | F | F+A | N | N | L | L | V | V |
| Vendors | V | V | V | V | F | F | V | V | V | V |
| Purchase documents | V | V | N | N | F | F+A | L | L | V | V |
| Stock transactions | V | V | V | V | V | V | F | F+A | V | V |
| Stock valuation reports | V | V | V | V | V | V | V | F | F | F |
| Payments and receipts | V | V | V | V | V | V | N | N | F | F |
| Journals and COA | V | V | N | N | N | N | N | N | F | F+A |
| Financial statements | F | V | N | N | N | N | N | N | F | F |
| Audit logs | V | F | N | N | N | N | N | N | V | F |

## 6. Document action matrix (MVP examples)
| Document | Create | Edit draft | Submit/Post | Cancel | Approve | Reverse |
|----------|--------|------------|-------------|--------|---------|---------|
| Quotation | Sales | Sales | Sales | Sales Mgr | Sales Mgr (discount cases) | N/A |
| Sales order | Sales | Sales | Sales | Sales Mgr | Optional | N/A |
| Delivery note | Warehouse/Sales | Draft owner | Warehouse | Warehouse Mgr | Optional | Via return |
| Sales invoice | Sales/Accountant | Draft owner | Sales/Accountant | Fin Ctrl | Optional | Credit note |
| Purchase order | Purchase | Purchase | Purchase | Purchase Mgr | Purchase Mgr | N/A |
| Goods receipt | Warehouse | Draft owner | Warehouse | Warehouse Mgr | Optional | Via return |
| Purchase invoice | Purchase/Accountant | Draft owner | Accountant | Fin Ctrl | Optional | Debit note |
| Stock transfer | Warehouse | Draft owner | Warehouse | Warehouse Mgr | Optional | Reverse transfer |
| Stock adjustment | Warehouse | Draft owner | Warehouse | Warehouse Mgr | Warehouse Mgr | Reverse adj |
| Journal entry | Accountant | Accountant | Accountant | Fin Ctrl | Fin Ctrl | Reverse journal |
| Payment/Receipt | Accountant | Accountant | Accountant | Fin Ctrl | Optional | Reverse entry |

## 7. Data scope rules
1. Branch-restricted users see only assigned branches
2. Warehouse-restricted users post only to assigned warehouses
3. Sales users may be limited to assigned customers
4. Purchase users may be limited to assigned vendor groups
5. Owner and Finance Controller typically have all-branch visibility

## 8. Segregation of duties recommendations
1. Same user should not create and approve high-value POs alone
2. Warehouse adjuster and adjustment approver should differ above threshold
3. Period unlock should require Finance Controller
4. Admin role should be separate from Accountant in larger tenants
5. Payroll run and employee master edits can be split when team size allows

## 9. Seed role templates for go-live
1. Provide default templates for Admin, Sales, Purchase, Warehouse, Accountant, Owner
2. Templates are editable per tenant
3. Do not ship with all-permissions role except temporary bootstrap admin

## 10. Acceptance criteria
1. Every MVP screen maps to at least one permission key
2. Unauthorized users cannot call restricted APIs successfully
3. Role changes take effect on next request
4. Audit log records permission-sensitive admin changes
