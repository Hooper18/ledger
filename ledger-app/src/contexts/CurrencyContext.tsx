import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Currency } from '../types'

const CACHE_KEY = 'ledger_fx_rates'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface CurrencyContextType {
  baseCurrency: Currency
  defaultCurrency: Currency
  rates: Record<string, number>
  ratesLoading: boolean
  setBaseCurrency: (c: Currency) => Promise<void>
  setDefaultCurrency: (c: Currency) => Promise<void>
  /** Convert `amount` (in `fromCurrency`) to baseCurrency */
  convert: (amount: number, fromCurrency: string) => number
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [baseCurrency, setBase] = useState<Currency>('CNY')
  const [defaultCurrency, setDefault] = useState<Currency>('CNY')
  // rates are relative to CNY: rates[X] = how many X per 1 CNY
  const [rates, setRates] = useState<Record<string, number>>({ CNY: 1 })
  const [ratesLoading, setRatesLoading] = useState(true)

  // Load preferred_currency and default_currency from users_profile
  useEffect(() => {
    if (!user) return
    supabase
      .from('users_profile')
      .select('preferred_currency, default_currency')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_currency) setBase(data.preferred_currency as Currency)
        if (data?.default_currency)   setDefault(data.default_currency as Currency)
      })
  }, [user])

  // Fetch exchange rates (cached 1 hr in localStorage)
  useEffect(() => {
    async function fetchRates() {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { ts, data } = JSON.parse(cached) as { ts: number; data: Record<string, number> }
          if (Date.now() - ts < CACHE_TTL) {
            setRates(data)
            setRatesLoading(false)
            return
          }
        }
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/CNY')
        const json = await res.json()
        setRates(json.rates)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: json.rates }))
      } catch {
        // keep default rates (only CNY:1), amounts in other currencies won't convert
      } finally {
        setRatesLoading(false)
      }
    }
    fetchRates()
  }, [])

  // amount (in fromCurrency) → baseCurrency
  const convert = useCallback(
    (amount: number, fromCurrency: string): number => {
      if (fromCurrency === baseCurrency) return amount
      const fromRate = rates[fromCurrency] ?? 1
      const toRate = rates[baseCurrency] ?? 1
      return (amount / fromRate) * toRate
    },
    [rates, baseCurrency],
  )

  const setBaseCurrency = useCallback(
    async (c: Currency) => {
      const prev = baseCurrency
      setBase(c)
      if (!user) return
      const { error } = await supabase
        .from('users_profile')
        .update({ preferred_currency: c })
        .eq('id', user.id)
      if (error) {
        console.error('upsert error:', JSON.stringify(error, null, 2))
        setBase(prev)
        throw error
      }
    },
    [user, baseCurrency],
  )

  const setDefaultCurrency = useCallback(
    async (c: Currency) => {
      const prev = defaultCurrency
      setDefault(c)
      if (!user) return
      const { error } = await supabase
        .from('users_profile')
        .update({ default_currency: c })
        .eq('id', user.id)
      if (error) {
        console.error('upsert error:', JSON.stringify(error, null, 2))
        setDefault(prev)
        throw error
      }
    },
    [user, defaultCurrency],
  )

  return (
    <CurrencyContext.Provider value={{ baseCurrency, defaultCurrency, rates, ratesLoading, convert, setBaseCurrency, setDefaultCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
