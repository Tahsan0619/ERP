# Feature Inventory

## Priority key
- P0: Must ship in MVP
- P1: Important, Phase 2 target
- P2: Later / Phase 3
- Status values: Planned, In progress, Done, Deferred

## 1. Identity and access
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| AUTH-001 | Login | User signs in with email and password | P0 | Identity | Valid users get session; invalid credentials rejected |
| AUTH-002 | Logout | User ends session | P0 | Identity | Session token invalidated |
| AUTH-003 | Password reset | Email-based reset flow | P0 | Identity | User can set new password via secure token |
| AUTH-004 | User management | Create, edit, activate, deactivate users | P0 | Identity | Admin can manage users in tenant |
| AUTH-005 | Role assignment | Assign one or more roles to user | P0 | Identity | Permissions reflect assigned roles |
| AUTH-006 | Permission checks | Enforce action-level permissions | P0 | Identity | Unauthorized API/UI actions blocked |
| AUTH-007 | Login history | Store login timestamps and IP metadata | P1 | Identity | Admin can view recent logins |
| AUTH-008 | 2FA | TOTP or SMS second factor | P2 | Identity | Optional 2FA challenge on login |
| AUTH-009 | Session timeout | Auto expire idle sessions | P0 | Identity | Idle timeout enforced by policy |

## 2. Organization and masters
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| ORG-001 | Company profile | Legal name, address, logo, currency | P0 | Masters | Company details appear on documents |
| ORG-002 | Fiscal year | Create and close fiscal years | P0 | Masters | Posting blocked outside open periods when locked |
| ORG-003 | Branches | Manage business branches | P0 | Masters | Documents can be tagged to branch |
| ORG-004 | Warehouses | Manage warehouses under branches | P0 | Masters | Stock tracked per warehouse |
| ORG-005 | Currencies | Maintain currency list and rates | P0 | Masters | Foreign currency docs calculate correctly |
| ORG-006 | Tax templates | Define tax rates and groups | P0 | Masters | Taxes apply on sales/purchase lines |
| ORG-007 | Payment terms | Net days and due date rules | P0 | Masters | Due dates auto-calc on invoices |
| ORG-008 | UOM | Units of measure master | P0 | Masters | Items require valid UOM |
| ORG-009 | Item groups | Categorize items | P0 | Masters | Items can be filtered by group |
| ORG-010 | Number series | Auto document numbering | P0 | Masters | Unique sequential numbers per doc type |
| ORG-011 | Price lists | Selling price lists | P1 | Masters | Sales rates can default from price list |
| ORG-012 | Cost centers | Tagging dimension for GL | P1 | Masters | Journals/docs accept cost center |
| ORG-013 | Print templates | Basic PDF layouts | P1 | Masters | Invoice/PO printable |

## 3. CRM and sales
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| SAL-001 | Customer master | Create/edit customers and contacts | P0 | Sales | Customer usable on sales docs |
| SAL-002 | Credit limit | Optional credit control | P1 | Sales | Warning or block when over limit |
| SAL-003 | Lead lite | Capture lead notes and status | P1 | Sales | Lead can convert to customer |
| SAL-004 | Quotation | Create and revise quotations | P0 | Sales | Quotation totals and taxes correct |
| SAL-005 | Quotation to order | Convert quotation to sales order | P0 | Sales | Line items carry forward |
| SAL-006 | Sales order | Create/edit/cancel sales orders | P0 | Sales | Order reserved/tracked against stock policy |
| SAL-007 | Delivery note | Deliver against sales order | P0 | Sales | Stock reduces on submit |
| SAL-008 | Sales invoice | Invoice against order/delivery | P0 | Sales | AR and income accounts post |
| SAL-009 | Credit note | Reverse or adjust sales invoice | P0 | Sales | Outstanding and stock policy handled |
| SAL-010 | Sales return | Return goods from customer | P0 | Sales | Stock increases and AR adjusts |
| SAL-011 | Customer statement | Statement of account | P0 | Sales | Opening, transactions, closing match ledger |
| SAL-012 | AR aging | Outstanding by age buckets | P0 | Sales | Buckets reconcile to unpaid invoices |
| SAL-013 | Discount controls | Line/header discounts with permission | P1 | Sales | Over-limit discount needs approval |

## 4. Purchasing and vendors
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| PUR-001 | Vendor master | Create/edit vendors and contacts | P0 | Purchase | Vendor usable on purchase docs |
| PUR-002 | Purchase requisition | Internal material request | P1 | Purchase | PR can convert to PO |
| PUR-003 | RFQ | Send and compare vendor quotes | P2 | Purchase | Selected quote converts to PO |
| PUR-004 | Purchase order | Create/approve/amend PO | P0 | Purchase | PO totals and taxes correct |
| PUR-005 | Goods receipt | Receive against PO | P0 | Purchase | Stock increases; qty cannot exceed allowed policy |
| PUR-006 | Purchase invoice | Vendor bill against receipt/PO | P0 | Purchase | AP and expense/asset accounts post |
| PUR-007 | Debit note | Adjust vendor bills | P0 | Purchase | AP reduces correctly |
| PUR-008 | Purchase return | Return goods to vendor | P0 | Purchase | Stock decreases and AP adjusts |
| PUR-009 | Vendor aging | AP outstanding buckets | P0 | Purchase | Reconciles to unpaid bills |
| PUR-010 | PO approval | Approve before send/receive | P1 | Purchase | Unapproved PO cannot progress |

## 5. Inventory and warehouses
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| INV-001 | Item master | Goods/service items with stock flags | P0 | Inventory | Stock items appear in balances |
| INV-002 | Stock balance | On-hand by warehouse | P0 | Inventory | Balance equals ledger sum |
| INV-003 | Stock ledger | Movement history per item | P0 | Inventory | Every posting creates ledger rows |
| INV-004 | Stock transfer | Move stock warehouse to warehouse | P0 | Inventory | Source decreases, target increases |
| INV-005 | Stock adjustment | Correct stock with reason | P0 | Inventory | Adjustment posts valuation impact |
| INV-006 | Low stock alerts | Reorder level warnings | P0 | Inventory | Items below reorder visible |
| INV-007 | Valuation moving average | Maintain valuation rate | P0 | Inventory | Receipts update average cost |
| INV-008 | Cycle count | Count and reconcile | P1 | Inventory | Variance posts adjustment |
| INV-009 | Batch tracking | Batch-wise stock | P1 | Inventory | Receipt/issue require batch when enabled |
| INV-010 | Serial tracking | Serial-wise stock | P1 | Inventory | Unique serial enforced |
| INV-011 | Stock reservation | Reserve against sales order | P1 | Inventory | Reserved qty cannot be double allocated |

## 6. Manufacturing light
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| MFG-001 | BOM | Define components for FG | P1 | Manufacturing | BOM validates component items |
| MFG-002 | Production order | Plan qty against BOM | P1 | Manufacturing | Required materials calculated |
| MFG-003 | Material consumption | Issue components to production | P1 | Manufacturing | Component stock reduces |
| MFG-004 | FG receipt | Receive finished goods | P1 | Manufacturing | FG stock increases |
| MFG-005 | Production cost rollup | Cost from consumed materials | P1 | Manufacturing | FG valuation reflects consumption |
| MFG-006 | Capacity planning | Machine/work center scheduling | P2 | Manufacturing | Deferred beyond light manufacturing |

## 7. Finance and accounting
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| FIN-001 | Chart of accounts | Create and maintain COA | P0 | Finance | Accounts usable in posting |
| FIN-002 | Manual journal | Debit/credit balanced entry | P0 | Finance | Unbalanced journals blocked |
| FIN-003 | Payment entry | Pay vendor or other payables | P0 | Finance | AP clears against selected bills |
| FIN-004 | Receipt entry | Receive customer payments | P0 | Finance | AR clears against selected invoices |
| FIN-005 | Bank accounts | Maintain company bank accounts | P0 | Finance | Payments/receipts post to bank GL |
| FIN-006 | Bank reconciliation | Match statement lines | P1 | Finance | Cleared vs uncleared balances visible |
| FIN-007 | Tax summary | Tax collected vs paid reports | P0 | Finance | Totals match posted tax lines |
| FIN-008 | Trial balance | Account balances report | P0 | Finance | Debits equal credits |
| FIN-009 | Profit and loss | Income statement | P0 | Finance | Period filter works |
| FIN-010 | Balance sheet | Assets = liabilities + equity | P0 | Finance | Statement balances |
| FIN-011 | Period lock | Lock accounting periods | P0 | Finance | Locked period rejects new posts |
| FIN-012 | Reverse entry | Reverse posted journal/docs | P0 | Finance | Reversal creates audit-safe opposite post |
| FIN-013 | Multi-currency GL | Gain/loss handling | P1 | Finance | Exchange differences posted |
| FIN-014 | Consolidation | Multi-company statements | P2 | Finance | Combined statements available |

## 8. HR and payroll
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| HR-001 | Employee master | Personal and job data | P1 | HR | Employee active for attendance/payroll |
| HR-002 | Departments | Org structure units | P1 | HR | Employees assigned to department |
| HR-003 | Designations | Job titles | P1 | HR | Employee has designation |
| HR-004 | Attendance | Daily attendance capture | P1 | HR | Present/absent/late stored |
| HR-005 | Leave types | Configure leave categories | P1 | HR | Balances tracked by type |
| HR-006 | Leave request | Request and approve leave | P1 | HR | Approved leave updates balance |
| HR-007 | Salary structure | Earnings and deductions | P2 | Payroll | Structure assignable to employee |
| HR-008 | Payroll run | Monthly payroll processing | P2 | Payroll | Net pay calculated correctly |
| HR-009 | Payslip | Generate and download payslip | P2 | Payroll | Payslip matches payroll lines |
| HR-010 | Employee self-service | View payslip/leave | P2 | HR | Employee sees only own data |

## 9. Reporting and dashboards
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| RPT-001 | Executive dashboard | KPI cards for sales, stock, cash | P0 | Reporting | KPIs match underlying reports |
| RPT-002 | Sales register | List posted sales invoices | P0 | Reporting | Filter by date/customer/item |
| RPT-003 | Purchase register | List posted purchase invoices | P0 | Reporting | Filter by date/vendor/item |
| RPT-004 | Stock balance report | On-hand and value | P0 | Reporting | Matches inventory balances |
| RPT-005 | Stock movement report | In/out movements | P0 | Reporting | Includes all entry types |
| RPT-006 | AR aging report | Receivables aging | P0 | Reporting | Matches unpaid invoices |
| RPT-007 | AP aging report | Payables aging | P0 | Reporting | Matches unpaid bills |
| RPT-008 | Export CSV/Excel | Export major reports | P0 | Reporting | Downloadable file opens correctly |
| RPT-009 | Saved filters | Persist user filters | P1 | Reporting | Filters restore on revisit |
| RPT-010 | Custom report packs | Configurable report sets | P2 | Reporting | Admin can group report shortcuts |

## 10. System settings, approvals, audit
| ID | Feature | Description | Priority | Module | Acceptance criteria |
|----|---------|-------------|----------|--------|---------------------|
| SYS-001 | Role matrix UI | Visual permission management | P0 | Settings | Changes apply immediately |
| SYS-002 | Approval rules | Conditional approvals | P1 | Settings | Matching docs enter approval state |
| SYS-003 | Notifications | In-app approval and alert feed | P1 | Settings | Recipients see unread items |
| SYS-004 | Attachments | Upload files on documents | P0 | Settings | Files retrievable by authorized users |
| SYS-005 | Audit log | Record create/update/delete/post | P0 | Settings | Admin can filter by user/entity/date |
| SYS-006 | Branding | Logo and letterhead settings | P0 | Settings | Printed docs show brand |
| SYS-007 | Email notifications | Email for approvals/alerts | P2 | Settings | Email sent on configured events |
| SYS-008 | Backup ops hooks | Export/backup procedures | P1 | Settings | Ops can restore tenant data |

## 11. MVP feature checklist (P0 only)
1. AUTH-001 to AUTH-006, AUTH-009
2. ORG-001 to ORG-010
3. SAL-001, SAL-004 to SAL-012
4. PUR-001, PUR-004 to PUR-009
5. INV-001 to INV-007
6. FIN-001 to FIN-005, FIN-007 to FIN-012
7. RPT-001 to RPT-008
8. SYS-001, SYS-004 to SYS-006

## 12. Tracking notes
1. Every sprint item should reference a feature ID
2. Do not start P1 work while P0 blockers remain in the same module dependency chain
3. When a feature splits, keep parent ID and add suffix (example: SAL-008A)
