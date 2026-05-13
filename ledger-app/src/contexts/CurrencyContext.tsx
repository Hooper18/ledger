import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Currency } from '../types'

const CACHE_KEY = 'ledger_fx_rates'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// 记账偏好：本地选择，不需要跨设备同步（每台设备习惯不同）。
const USE_LAST_USED_KEY = 'ledger_default_use_last_used'
const LAST_USED_CURRENCY_KEY = 'ledger_last_used_currency'

interface CurrencyContextType {
  baseCurrency: Currency
  /** 用户在 Settings 里固定选的"默认记账货币"。 */
  defaultCurrency: Currency
  /** Settings 是否选了"上次使用的货币"作为默认。 */
  useLastUsedAsDefault: boolean
  /** 实际给 AddTransaction 用的初始货币：开启了 last-used 就用上次的，否则用固定默认。 */
  effectiveDefaultCurrency: Currency
  rates: Record<string, number>
  ratesLoading: boolean
  setBaseCurrency: (c: Currency) => Promise<void>
  setDefaultCurrency: (c: Currency) => Promise<void>
  setUseLastUsedAsDefault: (v: boolean) => void
  /** AddTransaction 保存成功后调用，记录这次用了什么币种。 */
  recordLastUsedCurrency: (c: Currency) => void
  /** Convert `amount` (in `fromCurrency`) to baseCurrency */
  convert: (amount: number, fromCurrency: string) => number
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

function readUseLastUsed(): boolean {
  try {
    return localStorage.getItem(USE_LAST_USED_KEY) === '1'
  } catch {
    return false
  }
}

function readLastUsedCurrency(): Currency | null {
  try {
    return (localStorage.getItem(LAST_USED_CURRENCY_KEY) as Currency | null) ?? null
  } catch {
    return null
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [baseCurrency, setBase] = useState<Currency>('CNY')
  const [defaultCurrency, setDefault] = useState<Currency>('CNY')
  const [useLastUsedAsDefault, setUseLastUsedFlag] = useState<boolean>(readUseLastUsed)
  const [lastUsedCurrency, setLastUsed] = useState<Currency | null>(readLastUsedCurrency)
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
      .then(({ data, error }) => {
        if (error) return
        if (data) {
          if (data.preferred_currency) setBase(data.preferred_currency as Currency)
          if (data.default_currency)   setDefault(data.default_currency as Currency)
        } else {
          // Row missing (registered before trigger) — create it now with defaults
          supabase.from('users_profile').upsert({ id: user!.id })
        }
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
        .upsert({ id: user.id, preferred_currency: c })
      if (error) {
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
        .upsert({ id: user.id, default_currency: c })
      if (error) {
        setDefault(prev)
        throw error
      }
    },
    [user, defaultCurrency],
  )

  const setUseLastUsedAsDefault = useCallback((v: boolean) => {
    setUseLastUsedFlag(v)
    try {
      if (v) localStorage.setItem(USE_LAST_USED_KEY, '1')
      else localStorage.removeItem(USE_LAST_USED_KEY)
    } catch {
      // localStorage 满 / 被禁；忽略，效果就是关 App 后失忆，无碍记账
    }
  }, [])

  const recordLastUsedCurrency = useCallback((c: Currency) => {
    setLastUsed(c)
    try {
      localStorage.setItem(LAST_USED_CURRENCY_KEY, c)
    } catch {
      // 同上
    }
  }, [])

  const effectiveDefaultCurrency: Currency =
    useLastUsedAsDefault && lastUsedCurrency ? lastUsedCurrency : defaultCurrency

  return (
    <CurrencyContext.Provider value={{
      baseCurrency,
      defaultCurrency,
      useLastUsedAsDefault,
      effectiveDefaultCurrency,
      rates,
      ratesLoading,
      convert,
      setBaseCurrency,
      setDefaultCurrency,
      setUseLastUsedAsDefault,
      recordLastUsedCurrency,
    }}>
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
