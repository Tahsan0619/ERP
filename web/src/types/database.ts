export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Profile = {
  id: string
  tenant_id: string
  full_name: string
  email: string
  is_active: boolean
  customer_id?: string | null
  vendor_id?: string | null
}

export type Item = {
  id: string
  tenant_id: string
  sku: string
  name: string
  item_type: 'goods' | 'service'
  valuation_rate: number
  reorder_level: number
  is_stock_item: boolean
  is_active: boolean
}

export type Customer = {
  id: string
  tenant_id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  credit_limit: number
  is_active: boolean
}

export type Vendor = {
  id: string
  tenant_id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
}

export type SalesOrder = {
  id: string
  tenant_id: string
  doc_no: string
  status: string
  customer_id: string
  order_date: string
  grand_total: number
  customers?: { name: string } | null
}

export type PurchaseOrder = {
  id: string
  tenant_id: string
  doc_no: string
  status: string
  vendor_id: string
  order_date: string
  grand_total: number
  vendors?: { name: string } | null
}

export type StockBalance = {
  id: string
  qty_on_hand: number
  qty_reserved: number
  items?: { sku: string; name: string } | null
  warehouses?: { code: string; name: string } | null
}

export type Account = {
  id: string
  code: string
  name: string
  account_type: string
  is_active: boolean
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; tenant_id: string; email: string }; Update: Partial<Profile> }
      items: { Row: Item; Insert: Partial<Item> & { tenant_id: string; sku: string; name: string }; Update: Partial<Item> }
      customers: { Row: Customer; Insert: Partial<Customer> & { tenant_id: string; code: string; name: string }; Update: Partial<Customer> }
      vendors: { Row: Vendor; Insert: Partial<Vendor> & { tenant_id: string; code: string; name: string }; Update: Partial<Vendor> }
      sales_orders: { Row: SalesOrder; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      purchase_orders: { Row: PurchaseOrder; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      stock_balances: { Row: StockBalance; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      accounts: { Row: Account; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
    Functions: {
      bootstrap_tenant: {
        Args: { p_tenant_name: string; p_full_name: string }
        Returns: string
      }
      current_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      next_doc_number: {
        Args: { p_tenant_id: string; p_doc_type: string }
        Returns: string
      }
      post_credit_note: {
        Args: { p_credit_note_id: string }
        Returns: string
      }
      post_debit_note: {
        Args: { p_debit_note_id: string }
        Returns: string
      }
    }
  }
}
