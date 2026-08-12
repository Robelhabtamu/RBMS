import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { LoadingState } from '../../shared/components/LoadingState'
import { useAdminSettings } from '../hooks/useAdminSettings'
import { createPaymentMethod, saveBusinessName, savePrintPrice, saveVerificationSettings, updatePaymentMethod } from '../services/adminSettingsService'
import type { PaymentMethodSetting, VerificationSettings } from '../types/settings'
import { formatAdminEtb } from '../utils/format'

type Notice = { tone: 'success' | 'error'; text: string } | null
const input = 'min-h-10 rounded-lg border bg-white px-3 text-sm'

export function AdminSettingsPage() {
  const { settings, loading, error, refresh } = useAdminSettings()
  const [price, setPrice] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [verification, setVerification] = useState<VerificationSettings>({ paperAddition: false, faultyPaper: false, closing: false })
  const [saving, setSaving] = useState('')
  const [notices, setNotices] = useState<Record<string, Notice>>({})
  const [newMethod, setNewMethod] = useState({ code: '', name: '', sort: '40', proof: false })

  useEffect(() => {
    if (!settings) return
    setPrice(String(settings.printPrice))
    setBusinessName(settings.businessName)
    setVerification(settings.verification)
  }, [settings])

  async function run(key: string, action: () => Promise<void>, success: string) {
    if (saving) return
    setSaving(key)
    setNotices((current) => ({ ...current, [key]: null }))
    try {
      await action()
      setNotices((current) => ({ ...current, [key]: { tone: 'success', text: success } }))
      await refresh()
    } catch (cause) {
      setNotices((current) => ({ ...current, [key]: { tone: 'error', text: cause instanceof Error ? cause.message : 'Unable to save setting.' } }))
    } finally {
      setSaving('')
    }
  }

  if (loading && !settings) return <LoadingState label="Loading settings" />
  if (error || !settings) return <p className="rounded-2xl border bg-white p-10 text-center font-semibold text-red-700">{error ?? 'Settings unavailable.'}</p>

  function submitPrice(event: FormEvent) {
    event.preventDefault()
    const value = Number(price)
    if (!Number.isFinite(value) || value < 0) {
      setNotices((current) => ({ ...current, pricing: { tone: 'error', text: 'Print price must be zero or greater.' } }))
      return
    }
    const largeChange = value !== settings.printPrice && Math.abs(value - settings.printPrice) / Math.max(settings.printPrice, 1) >= 0.2
    if (largeChange && !window.confirm(`Change print price from ${formatAdminEtb(settings.printPrice)} to ${formatAdminEtb(value)}? Future transactions only.`)) return
    void run('pricing', () => savePrintPrice(value), 'Print price saved.')
  }

  const navigation = [['pricing', 'Pricing'], ['payments', 'Payments'], ['verification', 'Verification'], ['business', 'Business']]
  return <div className="mx-auto max-w-[1350px]">
    <header className="border-b pb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Admin</p><h1 className="mt-2 text-3xl font-bold">Settings</h1><p className="mt-2 text-sm text-gray-500">Configure RedBooth pricing, payments, verification, and business identity.</p></header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="h-fit rounded-2xl border bg-white p-3 shadow-sm lg:sticky lg:top-6">{navigation.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">{label}</a>)}</nav>
      <div className="space-y-6">
        <Section id="pricing" title="Print Pricing" description="The current ETB price is copied into future transactions; historical prices remain unchanged."><form onSubmit={submitPrice} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-sm font-medium">Current Print Price (ETB)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={`mt-2 block w-full sm:w-64 ${input}`} /></label><button disabled={saving === 'pricing'} className="min-h-10 rounded-lg bg-redbooth-600 px-4 font-bold text-white">{saving === 'pricing' ? 'Saving...' : 'Save Price'}</button></form><Feedback notice={notices.pricing} /></Section>
        <Section id="payments" title="Payment Methods" description="Manage stable payment codes, display names, order, active state, and proof requirement."><div className="space-y-3">{settings.paymentMethods.map((method) => <PaymentRow key={method.code} method={method} busy={Boolean(saving)} saving={saving === `payment-${method.code}`} notice={notices[`payment-${method.code}`]} onSave={(value) => void run(`payment-${method.code}`, () => updatePaymentMethod(value), `${value.displayName} saved.`)} />)}</div><form onSubmit={(event) => { event.preventDefault(); void run('new-payment', () => createPaymentMethod({ code: newMethod.code, displayName: newMethod.name, active: true, sortOrder: Number(newMethod.sort), requiresProof: newMethod.proof }), 'Payment method created.').then(() => setNewMethod({ code: '', name: '', sort: '40', proof: false })) }} className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-4"><input required value={newMethod.code} onChange={(event) => setNewMethod({ ...newMethod, code: event.target.value.toUpperCase() })} placeholder="CODE" className={input} /><input required value={newMethod.name} onChange={(event) => setNewMethod({ ...newMethod, name: event.target.value })} placeholder="Display name" className={input} /><input type="number" value={newMethod.sort} onChange={(event) => setNewMethod({ ...newMethod, sort: event.target.value })} className={input} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newMethod.proof} onChange={(event) => setNewMethod({ ...newMethod, proof: event.target.checked })} /> Requires proof</label><button className="min-h-10 rounded-lg border bg-white px-4 font-bold sm:col-span-4">Add Payment Method</button></form><Feedback notice={notices['new-payment']} /></Section>
        <Section id="verification" title="Verification Rules" description="Payment proof is configured per method; paper and closing proof settings remain available."><div className="space-y-3">{([['paperAddition', 'Paper Addition Proof'], ['faultyPaper', 'Faulty Paper Proof'], ['closing', 'Closing Proof']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border p-4 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={verification[key]} onChange={(event) => setVerification({ ...verification, [key]: event.target.checked })} /></label>)}</div><button onClick={() => void run('verification', () => saveVerificationSettings(verification), 'Verification settings saved.')} className="mt-4 min-h-10 rounded-lg bg-redbooth-600 px-4 font-bold text-white">Save Verification Rules</button><Feedback notice={notices.verification} /></Section>
        <Section id="business" title="Business" description="Currency and timezone remain fixed to protect reconciliation and business dates."><form onSubmit={(event) => { event.preventDefault(); void run('business', () => saveBusinessName(businessName), 'Business settings saved.') }} className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Business Name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className={`mt-2 w-full ${input}`} /></label><label className="text-sm font-medium">Currency<input readOnly value={settings.currency} className={`mt-2 w-full bg-gray-50 ${input}`} /></label><label className="text-sm font-medium">Timezone<input readOnly value="Africa/Addis_Ababa" className={`mt-2 w-full bg-gray-50 ${input}`} /></label><button className="min-h-10 rounded-lg bg-redbooth-600 px-4 font-bold text-white sm:col-span-3 sm:w-fit">Save Business Name</button></form><Feedback notice={notices.business} /></Section>
      </div>
    </div>
  </div>
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-6 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-gray-500">{description}</p><div className="mt-5">{children}</div></section>
}

function Feedback({ notice }: { notice: Notice }) {
  return notice ? <p className={`mt-3 text-sm font-medium ${notice.tone === 'success' ? 'text-green-700' : 'text-red-700'}`}>{notice.text}</p> : null
}

function PaymentRow({ method, onSave, saving, busy, notice }: { method: PaymentMethodSetting; onSave: (value: PaymentMethodSetting) => void; saving: boolean; busy: boolean; notice: Notice }) {
  const [value, setValue] = useState(method)
  useEffect(() => setValue(method), [method])
  return <div className="rounded-xl border p-4"><div className="grid gap-3 md:grid-cols-[110px_1fr_100px_150px_110px]"><input readOnly value={value.code} className={`${input} bg-gray-50 font-mono`} /><input value={value.displayName} onChange={(event) => setValue({ ...value, displayName: event.target.value })} className={input} /><input type="number" value={value.sortOrder} onChange={(event) => setValue({ ...value, sortOrder: Number(event.target.value) })} className={input} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.requiresProof} onChange={(event) => setValue({ ...value, requiresProof: event.target.checked })} /> Requires proof</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.active} onChange={(event) => setValue({ ...value, active: event.target.checked })} /> Active</label></div><button disabled={busy} onClick={() => onSave(value)} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button><Feedback notice={notice} /></div>
}
