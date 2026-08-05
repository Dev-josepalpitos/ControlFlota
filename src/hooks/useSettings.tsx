import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Settings {
  systemName: string
  currencyCode: string
  fuelPricePerLiter: number | null
}

interface SettingsContextValue extends Settings {
  loading: boolean
  refresh: () => Promise<void>
}

const DEFAULTS: Settings = {
  systemName: 'FlotaSaaS',
  currencyCode: 'ARS',
  fuelPricePerLiter: null,
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) {
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
      setSettings({
        systemName: map.system_name || DEFAULTS.systemName,
        currencyCode: map.currency_code || DEFAULTS.currencyCode,
        fuelPricePerLiter: map.fuel_price_per_liter ? Number(map.fuel_price_per_liter) : null,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    document.title = settings.systemName
  }, [settings.systemName])

  return (
    <SettingsContext.Provider value={{ ...settings, loading, refresh }}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>')
  return ctx
}
