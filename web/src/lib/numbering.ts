import { supabase } from './supabase'

export async function nextDocNo(tenantId: string, docType: string) {
  const { data, error } = await supabase.rpc('next_doc_number', {
    p_tenant_id: tenantId,
    p_doc_type: docType,
  })

  if (error || !data) {
    throw new Error(error?.message ?? `Number series missing for ${docType}`)
  }

  return data as string
}