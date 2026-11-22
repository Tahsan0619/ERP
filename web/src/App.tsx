import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { ItemsPage } from './pages/ItemsPage'
import { CustomersPage } from './pages/CustomersPage'
import { VendorsPage } from './pages/VendorsPage'
import { SalesOrdersPage } from './pages/SalesOrdersPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { StockPage } from './pages/StockPage'
import { AccountsPage } from './pages/AccountsPage'
import { SettingsPage } from './pages/SettingsPage'
import { GoodsReceiptsPage } from './pages/GoodsReceiptsPage'
import { DeliveryNotesPage } from './pages/DeliveryNotesPage'
import { SalesInvoicesPage } from './pages/SalesInvoicesPage'
import { PurchaseInvoicesPage } from './pages/PurchaseInvoicesPage'
import { JournalsPage } from './pages/JournalsPage'
import { ReceiptsPaymentsPage } from './pages/ReceiptsPaymentsPage'
import { QuotationsPage } from './pages/QuotationsPage'
import { StockMovesPage } from './pages/StockMovesPage'
import { ReportsPage } from './pages/ReportsPage'
import { OrgMastersPage } from './pages/OrgMastersPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { CreditDebitNotesPage } from './pages/CreditDebitNotesPage'
import { UsersRolesPage } from './pages/UsersRolesPage'
import { FiscalYearsPage } from './pages/FiscalYearsPage'
import { PrintDocPage } from './pages/PrintDocPage'
import { ManufacturingPage } from './pages/ManufacturingPage'
import { HrPage } from './pages/HrPage'
import { BankReconPage } from './pages/BankReconPage'
import { PortalPage } from './pages/PortalPage'
import { SecurityPage } from './pages/SecurityPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/print/:type/:id"
            element={
              <ProtectedRoute allowWithoutProfile>
                <PrintDocPage />
              </ProtectedRoute>
            }
          />
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
            <Route path="masters/org" element={<OrgMastersPage />} />
            <Route path="sales/quotations" element={<QuotationsPage />} />
            <Route path="sales/orders" element={<SalesOrdersPage />} />
            <Route path="sales/deliveries" element={<DeliveryNotesPage />} />
            <Route path="sales/invoices" element={<SalesInvoicesPage />} />
            <Route path="sales/notes" element={<CreditDebitNotesPage />} />
            <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
            <Route path="purchase/receipts" element={<GoodsReceiptsPage />} />
            <Route path="purchase/invoices" element={<PurchaseInvoicesPage />} />
            <Route path="inventory/stock" element={<StockPage />} />
            <Route path="inventory/moves" element={<StockMovesPage />} />
            <Route path="finance/accounts" element={<AccountsPage />} />
            <Route path="finance/journals" element={<JournalsPage />} />
            <Route path="finance/cash" element={<ReceiptsPaymentsPage />} />
            <Route path="finance/fiscal" element={<FiscalYearsPage />} />
            <Route path="finance/bank" element={<BankReconPage />} />
            <Route path="manufacturing" element={<ManufacturingPage />} />
            <Route path="hr" element={<HrPage />} />
            <Route path="portal" element={<PortalPage />} />
            <Route path="admin/users" element={<UsersRolesPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
