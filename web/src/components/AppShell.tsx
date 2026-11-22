import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Banknote,
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sales/orders', label: 'Sales orders', icon: ShoppingCart },
  { to: '/sales/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/sales/invoices', label: 'Sales invoices', icon: Receipt },
  { to: '/purchase/orders', label: 'Purchase orders', icon: ClipboardList },
  { to: '/purchase/receipts', label: 'Goods receipts', icon: Package },
  { to: '/purchase/invoices', label: 'Purchase invoices', icon: FileText },
  { to: '/inventory/stock', label: 'Stock balance', icon: Warehouse },
  { to: '/masters/items', label: 'Items', icon: Boxes },
  { to: '/masters/customers', label: 'Customers', icon: Users },
  { to: '/masters/vendors', label: 'Vendors', icon: Boxes },
  { to: '/finance/accounts', label: 'Chart of accounts', icon: FileText },
  { to: '/finance/journals', label: 'Journals', icon: FileText },
  { to: '/finance/cash', label: 'Receipts / payments', icon: Banknote },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OS</div>
          <div className="brand-name">BusinessOS</div>
        </div>
        <div className="nav-section">
          <div className="nav-label">Operations</div>
          {nav.map((item) => {
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
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">BusinessOS ERP</div>
          <div className="user-meta">
            <span>{profile?.full_name || profile?.email}</span>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
            >
              <LogOut size={16} />
              Sign out
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
