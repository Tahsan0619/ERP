import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  perm?: string
  perms?: string[]
}

type NavGroup = {
  key: string
  label?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    key: 'home',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { to: '/sales/quotations', label: 'Quotations', icon: FileText, perms: ['sales.view', 'sales.create', 'sales.post'] },
      { to: '/sales/orders', label: 'Sales orders', icon: ShoppingCart, perms: ['sales.view', 'sales.create', 'sales.post'] },
      { to: '/sales/deliveries', label: 'Deliveries', icon: Truck, perms: ['sales.view', 'sales.create', 'sales.post'] },
      { to: '/sales/invoices', label: 'Sales invoices', icon: Receipt, perms: ['sales.view', 'sales.create', 'sales.post'] },
      { to: '/sales/notes', label: 'Credit / debit notes', icon: ScrollText, perms: ['sales.view', 'sales.create', 'sales.post'] },
    ],
  },
  {
    key: 'purchase',
    label: 'Purchase',
    items: [
      { to: '/purchase/orders', label: 'Purchase orders', icon: ClipboardList, perms: ['purchase.view', 'purchase.create', 'purchase.post'] },
      { to: '/purchase/receipts', label: 'Goods receipts', icon: Package, perms: ['purchase.view', 'purchase.create', 'purchase.post'] },
      { to: '/purchase/invoices', label: 'Purchase invoices', icon: FileText, perms: ['purchase.view', 'purchase.create', 'purchase.post'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      { to: '/inventory/stock', label: 'Stock balance', icon: Warehouse, perms: ['inventory.view', 'inventory.post'] },
      { to: '/inventory/moves', label: 'Stock moves', icon: Warehouse, perms: ['inventory.view', 'inventory.post'] },
      { to: '/manufacturing', label: 'Manufacturing', icon: Package, perms: ['mfg.view', 'mfg.post'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      { to: '/finance/accounts', label: 'Chart of accounts', icon: FileText, perms: ['finance.view', 'finance.post'] },
      { to: '/finance/journals', label: 'Journals', icon: FileText, perms: ['finance.view', 'finance.post'] },
      { to: '/finance/cash', label: 'Receipts / payments', icon: Banknote, perms: ['finance.view', 'finance.post'] },
      { to: '/finance/fiscal', label: 'Fiscal years', icon: FileText, perm: 'admin.settings' },
      { to: '/finance/bank', label: 'Bank recon', icon: Banknote, perms: ['bank.view', 'bank.reconcile'] },
    ],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { to: '/hr', label: 'HR / payroll', icon: Users, perms: ['hr.view', 'hr.manage'] },
      { to: '/portal', label: 'Portal view', icon: Users, perms: ['portal.customer', 'portal.vendor'] },
    ],
  },
  {
    key: 'masters',
    label: 'Masters',
    items: [
      { to: '/masters/items', label: 'Items', icon: Boxes, perm: 'admin.settings' },
      { to: '/masters/customers', label: 'Customers', icon: Users, perm: 'admin.settings' },
      { to: '/masters/vendors', label: 'Vendors', icon: Boxes, perm: 'admin.settings' },
      { to: '/masters/org', label: 'Org masters', icon: Settings, perm: 'admin.settings' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users and roles', icon: Users, perm: 'admin.users' },
      { to: '/security', label: 'Security / 2FA', icon: Settings },
      { to: '/audit', label: 'Audit log', icon: ScrollText, perms: ['admin.users', 'admin.settings'] },
    ],
  },
  {
    key: 'reports',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, perms: ['reports.view', 'reports.export'] },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function showNavItem(item: NavItem, can: (code: string) => boolean, isAdmin: boolean) {
  if (item.perms?.length) return isAdmin || item.perms.some((p) => can(p))
  if (item.perm) return can(item.perm)
  return true
}

const SECTION_LABELS: Record<string, string> = {
  '/': 'Executive Dashboard',
  sales: 'Sales',
  purchase: 'Purchase',
  inventory: 'Inventory',
  finance: 'Finance',
  masters: 'Masters',
  manufacturing: 'Manufacturing',
  hr: 'HR & Payroll',
  portal: 'Portal',
  admin: 'Administration',
  security: 'Security',
  audit: 'Audit log',
  reports: 'Reports',
  settings: 'Settings',
}

function sectionFromPath(pathname: string): string {
  if (pathname === '/') return SECTION_LABELS['/']
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  return SECTION_LABELS[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function userInitial(profile: { full_name?: string | null; email?: string | null } | null) {
  const name = profile?.full_name?.trim()
  if (name) return name.charAt(0).toUpperCase()
  const email = profile?.email?.trim()
  if (email) return email.charAt(0).toUpperCase()
  return 'U'
}

export function AppShell() {
  const { profile, signOut } = useAuth()
  const { can, isAdmin, loading } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const section = sectionFromPath(location.pathname)

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: loading ? group.items : group.items.filter((item) => showNavItem(item, can, isAdmin)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OS</div>
          <div>
            <div className="brand-name">BusinessOS</div>
            <div className="brand-sub">ERP</div>
          </div>
        </div>
        <div className="sidebar-scroll">
          <div className="nav-groups">
            {visibleGroups.map((group) => (
              <div key={group.key} className="nav-section">
                {group.label ? <div className="nav-label">{group.label}</div> : null}
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <SidebarFooter />
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span>BusinessOS</span>
              <ChevronRight size={14} className="breadcrumb-sep" aria-hidden />
              <strong>{section}</strong>
            </nav>
          </div>
          <div className="topbar-search">
            <Search size={16} className="search-icon" aria-hidden />
            <input type="search" placeholder="Search orders, SKUs, accounts…" aria-label="Global search" readOnly tabIndex={-1} />
          </div>
          <div className="topbar-right">
            <WarehouseChip />
            <button type="button" className="btn btn-ghost topbar-user" title={profile?.email ?? ''}>
              <span className="name">{profile?.full_name || profile?.email || 'User'}</span>
              <span className="avatar" aria-hidden>
                {userInitial(profile)}
              </span>
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              title="Sign out"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarFooter() {
  return (
    <footer className="sidebar-footer">
      <div className="sync-chip">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dot" aria-hidden />
          Synced
        </span>
        <span className="meta">Live</span>
      </div>
    </footer>
  )
}

function WarehouseChip() {
  return (
    <div className="topbar-chip">
      <Warehouse size={15} aria-hidden />
      Main warehouse
    </div>
  )
}
