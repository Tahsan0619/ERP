import { supabase } from './supabase'

export async function nextDocNo(tenantId: string, docType: string) {
  const { data, error } = await supabase
    .from('number_series')
    .select('id, prefix, next_number')
    .eq('tenant_id', tenantId)
    .eq('doc_type', docType)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Number series missing for ${docType}`)
  }

  const docNo = `${data.prefix}${String(data.next_number).padStart(5, '0')}`
  const { error: updateError } = await supabase
    .from('number_series')
    .update({ next_number: data.next_number + 1 })
    .eq('id', data.id)

  if (updateError) throw new Error(updateError.message)
  return docNo
}
