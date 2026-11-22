# Design System and UI Spec

## 1. Purpose
This file is the single design brief for BusinessOS ERP. Use it in Stitch, Figma, Galileo, v0, Lovable, or any UI generator. Copy sections into prompts as needed. Keep visuals consistent across every screen.

## 2. Product UI summary
BusinessOS ERP is a dense but calm operations app for daily business work. Users live in lists, forms, document detail pages, and dashboards. Design for speed, clarity, and trust. Not a marketing site. Not a consumer social app.

## 3. Design direction
### Concept name
Operational Clear

### Look and feel in one paragraph
A bright, precise business workspace with cool graphite structure, soft paper surfaces, and a single sharp teal accent for primary actions. Screens feel like a modern operations console: strong hierarchy, generous table readability, quiet chrome, no neon glow, no glassmorphism, no purple gradients.

### Personality keywords
1. Precise
2. Calm
3. Operational
4. Trustworthy
5. Fast to scan

### Avoid
1. Purple or indigo brand themes
2. Neon glow and heavy blur glass effects
3. Warm cream paper with terracotta accent look
4. Newspaper broadsheet layouts
5. Rounded-full pill clusters everywhere
6. Multi-layer dramatic shadows
7. Emoji as UI decoration
8. Dark mode as the default (support later, design light first)

## 4. Brand
### Product name
BusinessOS

### Wordmark
1. One word, no space in logo lockup: BusinessOS
2. "Business" in medium weight, "OS" in semibold
3. Do not use an abstract orb or gradient sphere logo
4. Simple mark: rounded square with a small grid/ledger glyph in teal on graphite

### Logo clear space
Keep clear space equal to the height of the "O" around the mark.

### Favicon
Teal ledger-grid glyph on graphite rounded square.

## 5. Color tokens
Use exact hex values in design tools.

### Core
| Token | Hex | Usage |
|-------|-----|-------|
| color.bg.app | #F4F7FA | App background |
| color.bg.surface | #FFFFFF | Cards, panels, sheets |
| color.bg.subtle | #EEF2F6 | Table header, muted blocks |
| color.bg.sidebar | #15202B | Left navigation |
| color.bg.sidebar.hover | #1E2C3A | Sidebar item hover |
| color.bg.topbar | #FFFFFF | Top bar |
| color.border.default | #D7DEE7 | Borders, dividers |
| color.border.strong | #B7C2CF | Emphasized borders |
| color.text.primary | #15202B | Main text |
| color.text.secondary | #5B6B7C | Labels, help text |
| color.text.muted | #8494A7 | Placeholders, meta |
| color.text.inverse | #FFFFFF | Text on dark/sidebar/primary |
| color.accent.primary | #0F8B8D | Primary buttons, active states |
| color.accent.primary.hover | #0C7375 | Primary hover |
| color.accent.primary.soft | #E7F6F6 | Soft selected backgrounds |
| color.accent.focus | #2A6FDB | Focus ring only |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| color.success | #1F9D63 | Success, posted, paid |
| color.success.soft | #E8F8F0 | Success chips/backgrounds |
| color.warning | #C9811A | Warning, pending approval |
| color.warning.soft | #FFF5E6 | Warning chips/backgrounds |
| color.danger | #D64545 | Errors, overdue, destructive |
| color.danger.soft | #FDECEC | Error chips/backgrounds |
| color.info | #2A6FDB | Info banners |
| color.info.soft | #EAF2FF | Info chips/backgrounds |

### Chart palette (dashboards)
1. #0F8B8D
2. #2A6FDB
3. #C9811A
4. #1F9D63
5. #6B7C93
6. #D64545

### Contrast rules
1. Body text always on white or app background with primary text color
2. Sidebar text inverse on graphite
3. Never place muted gray text on soft teal backgrounds for critical labels
4. Destructive actions use danger color, never primary teal

## 6. Typography
### Font families
1. UI sans: "Manrope" for all product UI
2. Fallback: "Segoe UI", "Helvetica Neue", Arial, sans-serif
3. Mono for document numbers and IDs: "IBM Plex Mono"

### Why these fonts
Manrope is readable at small sizes and feels modern without looking like default Inter/Roboto AI templates. Mono keeps invoice and voucher IDs scannable.

### Type scale
| Token | Size | Weight | Line height | Use |
|-------|------|--------|-------------|-----|
| display | 28px | 700 | 36px | Rare page hero titles only |
| h1 | 22px | 700 | 30px | Page title |
| h2 | 18px | 650 | 26px | Section title |
| h3 | 16px | 650 | 24px | Card/section subtitle |
| body | 14px | 500 | 22px | Default text |
| body.strong | 14px | 650 | 22px | Emphasized values |
| label | 12px | 650 | 16px | Field labels, table headers |
| meta | 12px | 500 | 16px | Timestamps, helper text |
| tiny | 11px | 650 | 14px | Badges, chips |

### Typography rules
1. Page title left aligned with action buttons on the right
2. No centered marketing headlines inside app screens
3. Table numeric columns right aligned
4. Money and qty use tabular feel; mono optional for IDs only
5. Avoid all-caps except short badges

## 7. Layout and grid
### Shell
1. Left sidebar fixed width 248px
2. Top bar height 56px
3. Content canvas max width fluid, padded 24px
4. Minimum supported width 1280px for desktop primary design
5. Tablet: collapsible sidebar
6. Mobile: not primary for MVP; design desktop/tablet first

### Grid
1. 12-column content grid inside canvas
2. Gutter 16px
3. Form layouts commonly 1 column on narrow cards, 2 columns on wide forms
4. Document pages: header block, line-item table, totals footer

### Spacing scale (px)
4, 8, 12, 16, 20, 24, 32, 40, 48

### Density
1. Default density for operations tables: compact comfortable
2. Row height target 44px
3. Input height 40px
4. Primary button height 40px
5. Do not use oversized consumer-app spacing that wastes vertical space

## 8. Elevation and shape
### Radius
| Token | Value |
|-------|-------|
| radius.sm | 6px |
| radius.md | 10px |
| radius.lg | 14px |
| radius.pill | 999px (badges only, use sparingly) |

### Shadows
1. shadow.sm: 0 1px 2px rgba(21,32,43,0.06)
2. shadow.md: 0 8px 24px rgba(21,32,43,0.08)
3. No heavy multi-layer neon shadows
4. Prefer border + light shadow over floating dramatic cards

### Borders
1. Default 1px solid #D7DEE7
2. Tables use subtle horizontal rules; avoid heavy boxed every cell

## 9. Iconography
1. Style: outlined, 1.75px stroke, rounded joins
2. Size: 16px inline, 20px navigation, 24px empty states
3. Library suggestion: Lucide or Phosphor outline
4. Sidebar icons monochrome inverse; active item icon teal soft background
5. Never mix filled and outline icons randomly

## 10. App shell components
### Sidebar
1. Dark graphite background
2. Brand mark + BusinessOS at top
3. Module groups: Favorites, Sales, Purchase, Inventory, Finance, HR, Reports, Settings
4. Active item: soft teal tint background + teal accent bar on left
5. Collapsed mode shows icons only

### Top bar
1. White surface, bottom border
2. Left: page context breadcrumb
3. Center/right: global search
4. Right cluster: branch/warehouse switcher, notifications, user avatar menu

### Breadcrumb
Home / Module / Record title

### Page header pattern
1. Left: title + short subtitle/meta
2. Right: secondary actions then one primary action
3. Optional filter bar below header

## 11. Core UI components
### Buttons
1. Primary: teal fill, white text
2. Secondary: white fill, graphite text, gray border
3. Tertiary/ghost: no border, teal or graphite text
4. Destructive: danger fill or danger outline
5. Disabled: 40% opacity, no hover
6. Icon buttons: 40x40, secondary style

### Inputs
1. Label above field
2. Placeholder in muted text
3. Focus: 2px focus ring using color.accent.focus with 2px offset or inner border teal
4. Error: danger border + helper text below
5. Required marker: subtle asterisk after label

### Select, date, searchable combobox
1. Same height as inputs
2. Combobox for customers, vendors, items (typeahead)

### Tables
1. Sticky header
2. Checkbox column optional
3. Row hover subtle background
4. Status chip in status column
5. Right side row action menu (view/edit/print)
6. Footer pagination: rows per page + page numbers

### Chips / status badges
| Status | Style |
|--------|-------|
| Draft | gray soft |
| Submitted / Posted | success soft |
| Pending Approval | warning soft |
| Cancelled | muted gray |
| Overdue | danger soft |
| Partial | info soft |

### Cards
1. Use cards only for dashboard widgets and grouped settings
2. List/work screens prefer full-width table panels, not card grids of records
3. No card nesting deeper than one level

### Tabs
Underline tabs under page header for record subviews (Overview, Payments, Accounting, Audit)

### Modals / drawers
1. Modal for confirmations and small creates
2. Right drawer for quick edit and approvals
3. Always show clear title, close button, primary/secondary footer actions

### Empty states
1. Simple icon, one sentence, one CTA
2. Example: "No purchase orders yet. Create your first PO."

### Toasts
1. Top-right
2. Success/error/info variants
3. Short text, auto dismiss success, persist error until closed

### Skeleton loaders
1. Use for table and dashboard loading
2. Avoid full-page spinners when possible

## 12. Screen inventory to design
Design these screens as a connected system.

### Auth
1. Login
2. Forgot password
3. Reset password

### Shell
1. App shell with sidebar + top bar
2. Global search results

### Dashboard
1. Owner executive dashboard

### Masters
1. Items list + item form
2. Customers list + customer form
3. Vendors list + vendor form
4. Warehouses list
5. Tax templates / payment terms settings

### Sales
1. Quotations list
2. Quotation create/edit
3. Sales orders list
4. Sales order detail
5. Delivery note create
6. Sales invoice create/detail
7. Customer statement

### Purchase
1. Purchase orders list
2. PO create/edit
3. Goods receipt create
4. Purchase invoice create/detail
5. Vendor aging

### Inventory
1. Stock balance list
2. Stock ledger/movement view
3. Stock transfer form
4. Stock adjustment form
5. Low stock alert list

### Finance
1. Chart of accounts
2. Journal entry form
3. Payments and receipts list/form
4. Trial balance
5. Profit and loss
6. Balance sheet
7. AR aging / AP aging

### Admin
1. Users and roles
2. Permission matrix
3. Company settings
4. Audit log list

## 13. Key screen layouts

### 13.1 Login
1. Split or centered card on app background
2. Left optional brand panel with calm abstract ledger grid, not stock photos of random offices
3. Fields: email, password, remember me, login button
4. Links: forgot password
5. No social login buttons in MVP

### 13.2 Executive dashboard
1. Page title: Dashboard
2. Filter row: date range, branch
3. KPI row (4): Sales today/MTD, Purchases MTD, Stock value, Cash position
4. Two charts: sales trend, top items
5. Two tables: overdue receivables, low stock
6. Do not overload with more than 4 KPI cards in first viewport

### 13.3 List screen pattern (orders, invoices, POs)
1. Header + primary Create button
2. Filter chips/row: status, date range, party, warehouse, search
3. Data table
4. Pagination
5. Optional right drawer preview on row click

### 13.4 Document create/edit pattern (SO, PO, Invoice)
1. Header: document title, number, status chip, actions (Save draft, Submit, Print)
2. Party and metadata section (2-column)
3. Line items editable table: item, description, qty, rate, tax, discount, amount
4. Add line button
5. Totals panel right aligned: subtotal, tax, discount, grand total
6. Notes and attachments at bottom
7. Sticky action footer on long forms

### 13.5 Document detail pattern
1. Read-only posted view
2. Timeline/audit mini panel
3. Linked documents (order -> delivery -> invoice)
4. Actions depend on status

### 13.6 Stock balance
1. Filters: warehouse, item group, search
2. Table: item, SKU, warehouse, on hand, reserved, available, value
3. Low stock highlight on available column

### 13.7 Journal entry
1. Balanced debit/credit table
2. Running difference indicator
3. Block submit when unbalanced
4. Strong validation messaging

### 13.8 Users and roles
1. Users table with role chips
2. Role editor with permission matrix grouped by module
3. Toggle view/create/edit/approve/export per entity

## 14. Content and microcopy rules
1. Use plain business language
2. Prefer "Create sales order" not "New SO magic"
3. Errors say what happened and how to fix
4. Empty states invite one next action
5. No jokes in finance/posting errors
6. Dates: DD MMM YYYY in UI examples (localizable)
7. Money: show currency code or symbol consistently

### Sample microcopy
1. Success: "Sales invoice INV-002184 posted."
2. Error: "Cannot submit. Credit total must equal debit total."
3. Warning: "Stock available is below ordered qty for 2 items."
4. Confirm destructive: "Cancel this purchase order? You cannot undo this."

## 15. Motion
Keep motion subtle and purposeful.
1. Sidebar active state fades 120ms
2. Drawer slides from right 180ms ease-out
3. Toast enters from top-right 150ms
4. No bouncing buttons
5. No parallax
6. Table row highlight instant or 80ms max

## 16. Accessibility
1. Contrast AA minimum for text
2. Visible focus ring on all controls
3. Do not rely on color alone for status; include text chips
4. Form labels always visible, not placeholder-only
5. Keyboard: tab order logical, Esc closes modal/drawer

## 17. Responsive behavior
### Desktop (1280+)
Full sidebar + dense tables

### Tablet (768 to 1279)
1. Collapsible sidebar
2. Filters collapse into "Filters" button
3. KPI cards wrap 2x2
4. Document forms stack totals below lines

### Mobile (<768)
1. Not MVP priority
2. If shown, limit to approvals, dashboard KPIs, and read-only document view

## 18. Asset checklist for design tools
1. Logo SVG (mark + wordmark)
2. Favicon
3. Sidebar icons set (20px)
4. Empty state icons
5. Sample avatars
6. Sample printable invoice layout matching brand colors

## 19. Stitch / UI generator master prompt
Copy this block into Stitch or similar tools:

```text
Design a web ERP product UI called BusinessOS.

Visual direction: Operational Clear. Light, precise, calm business operations software.
Colors: app background #F4F7FA, surfaces #FFFFFF, sidebar #15202B, primary accent teal #0F8B8D, text #15202B, secondary text #5B6B7C, borders #D7DEE7, success #1F9D63, warning #C9811A, danger #D64545.
Typography: Manrope for UI, IBM Plex Mono for document IDs. Dense but readable.
Layout: left dark sidebar 248px, white top bar 56px, content padding 24px.
Components: clean tables, 40px inputs, teal primary buttons, subtle status chips, right drawers, no purple, no neon glow, no glassmorphism, no emoji decoration, no oversized consumer spacing.
Tone: professional operations console for sales, purchase, inventory, and finance users.
```

## 20. Ready prompts per screen
Use one prompt at a time. Keep the master visual direction attached above each prompt.

### Prompt: Login
```text
BusinessOS ERP login screen. Light app background #F4F7FA. Centered white login card with BusinessOS wordmark, email and password fields, teal #0F8B8D login button, forgot password link. Clean Manrope typography. No social login. No purple. No illustrations clutter.
```

### Prompt: App shell
```text
BusinessOS ERP desktop app shell. Dark graphite sidebar #15202B with BusinessOS logo and module nav (Dashboard, Sales, Purchase, Inventory, Finance, Reports, Settings). White top bar with breadcrumbs, search, branch switcher, notifications, user menu. Content area #F4F7FA. Active nav item uses soft teal tint and teal accent. Professional SaaS ERP look.
```

### Prompt: Dashboard
```text
BusinessOS ERP executive dashboard. Page header Dashboard with date range and branch filters. Four KPI cards: Sales MTD, Purchases MTD, Stock value, Cash position. Line chart for sales trend and bar chart for top items using teal/blue/amber palette. Two tables: overdue receivables and low stock items. Clean white panels on #F4F7FA, Manrope font, no purple, no neon.
```

### Prompt: Sales orders list
```text
BusinessOS ERP sales orders list page. Header with title Sales Orders and primary button Create sales order in teal. Filter row for status, date, customer, search. Data table columns: Order No, Date, Customer, Status chip, Total, Delivery status, actions. Compact 44px rows, sticky header, pagination footer. Desktop 1440 width.
```

### Prompt: Create sales order
```text
BusinessOS ERP create sales order form. Header with Save draft and Submit buttons. Two-column metadata: customer searchable select, order date, delivery date, warehouse, price list, payment terms. Editable line items table with item, qty, rate, tax, discount, amount. Right-aligned totals panel for subtotal, tax, grand total. Notes and attachments section. Teal primary actions, clean borders, Manrope.
```

### Prompt: Stock balance
```text
BusinessOS ERP stock balance screen. Filters for warehouse and item group. Table: Item, SKU, Warehouse, On hand, Reserved, Available, Valuation rate, Stock value. Highlight low available qty with warning chip. Export button secondary. Clean operational inventory UI.
```

### Prompt: Purchase order detail
```text
BusinessOS ERP purchase order detail page. Document header with PO number in monospace, status chip Posted, actions Print and Create receipt. Vendor and metadata summary. Line items read-only table. Totals block. Linked documents section showing GRN and Purchase Invoice links. Audit mini timeline on the right.
```

### Prompt: Invoice PDF-style preview
```text
BusinessOS sales invoice print preview. White A4 style sheet, BusinessOS logo top left, invoice number top right in mono, bill-to block, item table, tax breakdown, grand total emphasis, teal accents used sparingly for headers only, professional finance document.
```

### Prompt: Journal entry
```text
BusinessOS ERP journal entry screen. Title New journal entry. Fields for date, remark, currency. Debit/credit entry table with account combobox, cost center optional, debit amount, credit amount. Live difference indicator showing Unbalanced in red until zero. Submit disabled until balanced. Clean finance UI.
```

### Prompt: Users and roles
```text
BusinessOS ERP admin users and roles page. Tabs: Users, Roles. Users table with name, email, roles chips, status, last login. Role permission matrix grouped by Sales, Purchase, Inventory, Finance with toggles for view/create/edit/approve/export. Teal switches/checks, graphite text, clear section headers.
```

### Prompt: Empty state example
```text
BusinessOS ERP empty purchase orders state inside list page layout. Simple outline icon, text "No purchase orders yet", helper "Create a PO to start purchasing", teal button Create purchase order. Keep sidebar and top bar visible.
```

## 21. Design QA checklist
1. Same teal primary everywhere
2. Sidebar consistently dark graphite
3. Tables readable at density without cramped clipping
4. Status relies on text chip + color
5. Posted documents look locked/read-only
6. No random alternate accent colors per module
7. Forms have sticky or persistent primary actions
8. Every list has clear Create or Import path
9. Focus states visible
10. Screens look like one product family in a Stitch board

## 22. Deliverable set to produce in Stitch
1. Foundations board: colors, type, buttons, inputs, chips, table
2. Shell board: sidebar + top bar variants
3. Dashboard board
4. Sales board: list + create + detail
5. Purchase board: list + create + detail
6. Inventory board: balances + transfer + adjustment
7. Finance board: journal + payments + reports
8. Admin board: users/roles + settings + audit
9. Auth board: login + reset

## 23. Handoff notes for engineering
1. Implement tokens as CSS variables matching Section 5 and 6
2. Component library should mirror Section 11 before feature pages
3. Do not invent new colors per feature
4. Document screens must reuse one document layout template
5. If a generated Stitch screen drifts from tokens, restyle to this file before coding
