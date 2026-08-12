import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { AdminSettings, PaymentMethodSetting, VerificationSettings } from '../types/settings'

const supabase = () => getSupabaseClient()
const friendly = (error: PostgrestError | null, fallback: string) => error?.code === '42501' ? 'You do not have permission to change settings.' : fallback
const settingValue = (rows: Array<{ key: unknown; value: unknown }>, key: string, fallback: unknown) => rows.find((row) => row.key === key)?.value ?? fallback

export async function getAdminSettings(): Promise<AdminSettings> {
  const [settings, methods] = await Promise.all([
    supabase().from('app_settings').select('key, value').in('key', ['current_print_price', 'business_name', 'currency', 'require_paper_addition_proof', 'require_faulty_paper_proof', 'require_closing_proof']),
    supabase().from('payment_methods').select('code, display_name, active, sort_order, requires_proof').order('sort_order'),
  ])
  if (settings.error || methods.error) throw new Error('Settings could not be loaded. Apply the latest Supabase migration.')
  const rows = (settings.data ?? []) as Array<{ key: unknown; value: unknown }>
  return {
    printPrice: Number(settingValue(rows, 'current_print_price', 0)), businessName: String(settingValue(rows, 'business_name', 'RedBooth')), currency: String(settingValue(rows, 'currency', 'ETB')),
    paymentMethods: (methods.data ?? []).map((r) => ({ code: String(r.code), displayName: String(r.display_name), active: Boolean(r.active), sortOrder: Number(r.sort_order), requiresProof: Boolean(r.requires_proof) })),
    verification: { paperAddition: Boolean(settingValue(rows, 'require_paper_addition_proof', false)), faultyPaper: Boolean(settingValue(rows, 'require_faulty_paper_proof', false)), closing: Boolean(settingValue(rows, 'require_closing_proof', false)) },
  }
}

async function saveSetting(key: string, value: string | number | boolean) { const { error } = await supabase().from('app_settings').update({ value }).eq('key', key); if (error) throw new Error(friendly(error, 'Unable to save setting.')) }
export async function savePrintPrice(value: number) { if (!Number.isFinite(value) || value < 0) throw new Error('Print price must be zero or greater.'); await saveSetting('current_print_price', value) }
export async function saveBusinessName(value: string) { if (!value.trim()) throw new Error('Business name is required.'); await saveSetting('business_name', value.trim()) }
export async function saveVerificationSettings(value: VerificationSettings) { const results = await Promise.all([supabase().from('app_settings').update({ value: value.paperAddition }).eq('key', 'require_paper_addition_proof'), supabase().from('app_settings').update({ value: value.faultyPaper }).eq('key', 'require_faulty_paper_proof'), supabase().from('app_settings').update({ value: value.closing }).eq('key', 'require_closing_proof')]); if (results.some((r) => r.error)) throw new Error('Unable to save verification settings.') }

export async function createPaymentMethod(method: PaymentMethodSetting) { const code = method.code.trim().toUpperCase(); if (!/^[A-Z][A-Z0-9_]*$/.test(code)) throw new Error('Code must use uppercase letters, numbers, or underscores.'); const { error } = await supabase().from('payment_methods').insert({ code, display_name: method.displayName.trim(), active: method.active, sort_order: method.sortOrder, requires_proof: method.requiresProof }); if (error) throw new Error(friendly(error, 'Payment method could not be created.')) }
export async function updatePaymentMethod(method: PaymentMethodSetting) { const { error } = await supabase().from('payment_methods').update({ display_name: method.displayName.trim(), active: method.active, sort_order: method.sortOrder, requires_proof: method.requiresProof }).eq('code', method.code); if (error) throw new Error(friendly(error, 'Payment method could not be updated.')) }
