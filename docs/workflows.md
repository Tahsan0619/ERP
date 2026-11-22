# Core Workflows

## 1. Purpose
Describe end-to-end operational flows for BusinessOS ERP. Each workflow lists actors, steps, system effects, and failure points.

## 2. Order to cash (sales)
### Goal
Convert customer demand into delivery, invoice, and payment collection.

### Actors
Sales User, Warehouse User, Accountant, Sales Manager (approvals)

### Steps
1. Create or select customer in customer master
2. Create quotation with items, qty, rates, taxes, discounts
3. Send quotation (print/PDF/export)
4. Convert accepted quotation to sales order
5. Check stock availability by warehouse
6. Create delivery note against sales order
7. On delivery submit, reduce stock and update delivered qty
8. Create sales invoice against delivery or order policy
9. On invoice submit, post AR and income/tax entries
10. Record receipt entry against invoice
11. Clear outstanding and update customer statement

### System effects
1. Stock ledger issues on delivery
2. GL posts on invoice and receipt
3. AR aging updates
4. Sales register updates

### Variations
1. Cash sales: invoice and receipt in one business flow
2. Partial delivery: multiple delivery notes against one order
3. Sales return: return note + credit note

### Failure points
1. Insufficient stock
2. Credit limit breach
3. Unapproved high discount
4. Period locked for posting date

## 3. Procure to pay (purchasing)
### Goal
Buy materials/goods, receive them, account the bill, and pay the vendor.

### Actors
Purchase User, Purchase Manager, Warehouse User, Accountant

### Steps
1. Identify shortage via low stock or sales demand
2. Create purchase requisition (Phase 2) or create PO directly (MVP)
3. Create purchase order with vendor, items, qty, rates, taxes
4. Submit PO; approve if approval rules require
5. Vendor supplies goods
6. Create goods receipt note against PO
7. On GRN submit, increase stock and update received qty
8. Create purchase invoice against GRN/PO
9. On bill submit, post AP and expense/inventory/tax entries
10. Record payment entry against bill
11. Clear vendor outstanding

### System effects
1. Stock ledger receipts on GRN
2. Moving average cost updates on receipt/bill policy
3. GL posts on bill and payment
4. AP aging updates

### Variations
1. Partial receipts
2. Over-receipt policy controlled by settings
3. Purchase return + debit note
4. Service purchases without stock movement

### Failure points
1. Receiving more than allowed tolerance
2. Unapproved PO
3. Mismatch between GRN and vendor bill
4. Locked accounting period

## 4. Inventory transfer between warehouses
### Goal
Move stock from one warehouse to another with full traceability.

### Actors
Warehouse User, Warehouse Manager

### Steps
1. Create stock transfer document
2. Select source warehouse, target warehouse, items, qty
3. Submit transfer
4. System decreases source and increases target
5. Stock ledger writes both sides
6. Managers review transfer register

### Failure points
1. Insufficient source qty
2. Same source and target warehouse
3. Batch/serial missing when required (Phase 2)

## 5. Stock adjustment and cycle count
### Goal
Correct book stock to physical reality.

### Actors
Warehouse User, Warehouse Manager

### Steps
1. Start cycle count for warehouse/item group
2. Enter counted qty
3. System computes variance
4. Create adjustment draft from variance
5. Manager approves if above threshold
6. Post adjustment and update stock ledger and valuation

### Failure points
1. Unapproved high-value variance
2. Counting wrong UOM
3. Posting in locked period

## 6. Quote to order conversion
### Goal
Avoid re-entry and preserve commercial terms.

### Steps
1. Open accepted quotation
2. Convert to sales order
3. Carry customer, lines, taxes, discounts
4. Allow qty edits before submit per policy
5. Mark quotation as converted/ordered

## 7. Return flows
### Customer return
1. Create sales return against invoice/delivery
2. Receive goods into warehouse
3. Create credit note
4. Adjust stock and AR

### Vendor return
1. Create purchase return against GRN/bill
2. Issue goods out of warehouse
3. Create debit note
4. Adjust stock and AP

## 8. Record to report (finance close)
### Goal
Produce reliable financial statements for a period.

### Actors
Accountant, Finance Controller

### Steps
1. Ensure all sales, purchase, stock, payment docs for period are posted
2. Review AR/AP aging and unmatched entries
3. Post accruals and manual journals
4. Review tax summary
5. Run trial balance and investigate imbalances or odd accounts
6. Run P&L and balance sheet
7. Controller locks the period
8. Export reports for management

### Failure points
1. Draft documents left unposted
2. Stock valuation pending documents
3. Period lock attempted with unresolved critical exceptions

## 9. Manufacturing light (Phase 2)
### Goal
Convert components into finished goods with cost rollup.

### Steps
1. Create BOM for finished good
2. Create production order for qty
3. System calculates required components
4. Issue/consume components to production
5. Receive finished goods into warehouse
6. Roll material cost into FG valuation
7. Close production order

### Out of this workflow
1. Machine scheduling
2. Labor time booking advanced MES
3. Scrap analytics sophistication beyond basic loss qty

## 10. Hire to pay (HR/payroll, Phase 2 to 3)
### Steps
1. Create employee record and assignment
2. Capture attendance and approved leave
3. Assign salary structure
4. Run payroll for period
5. Review earnings, deductions, net pay
6. Generate payslips
7. Post payroll summary journal to finance
8. Pay employees through payment process

## 11. User onboarding workflow
### Steps
1. Admin creates company/branch/warehouse
2. Admin configures fiscal year, taxes, number series
3. Admin creates role assignments
4. Admin invites users
5. Users set passwords and log in
6. Masters team loads items, customers, vendors
7. Opening balances and opening stock entered
8. Go-live checklist signed by Owner and Finance Controller

## 12. Approval workflow pattern (Phase 2 standard)
1. User submits document
2. System evaluates approval rules (amount, discount, adjustment value)
3. Document enters Pending Approval
4. Approver receives notification
5. Approver approves or rejects with note
6. On approve, document becomes submittable/posted per rule
7. On reject, document returns to draft with reason

## 13. Workflow SLAs (targets)
| Workflow | Target cycle time |
|----------|-------------------|
| Quotation create | Under 3 minutes |
| Sales order create | Under 2 minutes |
| GRN for standard PO | Under 3 minutes |
| Invoice posting | Under 2 minutes |
| Period lock after all posts | Same day for small tenants |

## 14. Cross-workflow invariants
1. No stock movement without a document
2. No AR/AP balance change without a financial document
3. Posted docs require reverse/amend patterns, not silent edits
4. Every submit stores actor, timestamp, and before/after audit where relevant
5. Reports must read posted data, not only draft data, unless report says otherwise

## 15. Acceptance criteria
1. Each MVP workflow can be demonstrated with sample data
2. Partial delivery and partial receipt both work
3. Customer and vendor return paths keep stock and ledgers consistent
4. Period lock blocks new posts in locked dates
