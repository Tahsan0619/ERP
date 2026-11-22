export type TaxTemplate = { id: string; name: string; rate: number }

export function calcLineAmounts(qty: number, rate: number, taxRatePct: number) {
  const subtotal = qty * rate
  const taxAmount = (subtotal * taxRatePct) / 100
  return {
    subtotal,
    taxAmount,
    grandTotal: subtotal + taxAmount,
    taxRate: taxRatePct,
  }
}
