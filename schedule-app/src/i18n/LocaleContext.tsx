import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { zh } from './locales/zh'
import { en } from './locales/en'

export type Locale = 'zh' | 'en'

const dictionaries = { zh, en } as const

const STORAGE_KEY = 'schedule-locale'

// 把嵌套词典扁平化成 dot-path 联合类型，确保 t('userMenu.balance') 编译期可校验。
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

export type TKey = Paths<typeof zh>

export type TParams = Record<string, string | number>

export type TFn = (key: TKey, params?: TParams) => string

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TFn
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function detectInitial(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // localStorage 不可用（隐私模式等）→ 走浏览器语言
  }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language || '').toLowerCase()
    if (lang.startsWith('zh')) return 'zh'
    return 'en'
  }
  return 'zh'
}

function lookup(dict: unknown, path: string): string {
  const parts = path.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return path
    }
  }
  return typeof cur === 'string' ? cur : path
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  )
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitial())

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // 隐私模式：本会话生效，下次回到自动检测，可接受
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const value = useMemo<LocaleContextValue>(() => {
    const dict = dictionaries[locale]
    return {
      locale,
      setLocale,
      t: (key, params) => interpolate(lookup(dict, key), params),
    }
  }, [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const v = useContext(LocaleContext)
  if (!v) throw new Error('useLocale must be used within LocaleProvider')
  return v
}

export function useT(): TFn {
  return useLocale().t
}

// 在非 React 环境（lib 函数 / 普通模块）里读当前 locale。
// 直接读 localStorage —— 与 LocaleProvider 写入的 key 同步。
export function getActiveLocale(): Locale {
  return detectInitial()
}

// 静态版 t —— 没有 React 上下文时使用（通知正文、文件解析 throw 等）。
// 每次调用都重新读 localStorage，所以语言切换后下次调用即生效。
export const tStatic: TFn = (key, params) => {
  const dict = dictionaries[detectInitial()]
  return interpolate(lookup(dict, key), params)
}
