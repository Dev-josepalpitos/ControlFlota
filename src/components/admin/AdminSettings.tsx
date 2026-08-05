import { useEffect, useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const CURRENCIES = [
  { code: 'ARS', label: 'ARS — Peso Argentino' },
  { code: 'USD', label: 'USD — Dólar Estadounidense' },
  { code: 'UYU', label: 'UYU — Peso Uruguayo' },
  { code: 'CLP', label: 'CLP — Peso Chileno' },
  { code: 'BRL', label: 'BRL — Real Brasileño' },
  { code: 'MXN', label: 'MXN — Peso Mexicano' },
]

export default function AdminSettings() {
  const { refresh: refreshGlobalSettings } = useSettings()
  const [form, setForm] = useState({ system_name: '', currency_code: 'ARS', fuel_price_per_liter: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) {
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
      setForm({
        system_name: map.system_name ?? 'FlotaSaaS',
        currency_code: map.currency_code ?? 'ARS',
        fuel_price_per_liter: map.fuel_price_per_liter ?? '',
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form.system_name.trim()) {
      toast.error('El nombre del sistema no puede estar vacío.')
      return
    }
    const price = Number(form.fuel_price_per_liter)
    if (!form.fuel_price_per_liter || Number.isNaN(price) || price <= 0) {
      toast.error('Ingresá un precio de combustible válido (mayor a 0).')
      return
    }

    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const updates = [
      { key: 'system_name', value: form.system_name.trim() },
      { key: 'currency_code', value: form.currency_code },
      { key: 'fuel_price_per_liter', value: String(price) },
    ]

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('app_settings')
          .update({ value: u.value, updated_at: new Date().toISOString(), updated_by: user?.id })
          .eq('key', u.key),
      ),
    )

    setSaving(false)

    const failed = results.find((r) => r.error)
    if (failed?.error) {
      toast.error('No se pudo guardar la configuración', { description: failed.error.message })
      return
    }

    toast.success('Configuración actualizada')
    refreshGlobalSettings()
  }

  if (loading) {
    return <Skeleton className="h-80 w-full max-w-md" />
  }

  return (
    <div className="max-w-md">
      <div className="rounded-lg border p-5 space-y-5">
        <div>
          <h2 className="font-medium mb-1">Configuración General</h2>
          <p className="text-sm text-muted-foreground">
            Estos valores se usan en toda la app: nombre visible, moneda de los reportes y precio de combustible.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del sistema</Label>
            <Input
              value={form.system_name}
              onChange={(e) => setForm({ ...form, system_name: e.target.value })}
              placeholder="Ej: Flota Transportes del Norte"
            />
            <p className="text-xs text-muted-foreground">Aparece en la barra superior y en el título de la pestaña del navegador.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <select
              value={form.currency_code}
              onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Precio de combustible por litro</Label>
            <Input
              type="number"
              step="0.01"
              value={form.fuel_price_per_liter}
              onChange={(e) => setForm({ ...form, fuel_price_per_liter: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Se usa para calcular los litros automáticamente al registrar una carga de combustible.
            </p>
          </div>

          <Button type="submit" loading={saving} className="w-full">
            Guardar Configuración
          </Button>
        </form>
      </div>
    </div>
  )
}
