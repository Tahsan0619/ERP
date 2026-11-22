import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { DashboardPage } from './pages/DashboardPage'
import { ItemsPage } from './pages/ItemsPage'
import { CustomersPage } from './pages/CustomersPage'
import { VendorsPage } from './pages/VendorsPage'
import { SalesOrdersPage } from './pages/SalesOrdersPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { StockPage } from './pages/StockPage'
import { AccountsPage } from './pages/AccountsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="masters/items" element={<ItemsPage />} />
            <Route path="masters/customers" element={<CustomersPage />} />
            <Route path="masters/vendors" element={<VendorsPage />} />
            <Route path="sales/orders" element={<SalesOrdersPage />} />
            <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
            <Route path="inventory/stock" element={<StockPage />} />
            <Route path="finance/accounts" element={<AccountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
