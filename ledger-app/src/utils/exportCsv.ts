import { supabase } from '../lib/supabase'

export type ExportRange = 'all' | 'thisMonth' | 'custom'

export interface ExportOptions {
  userId: string
  baseCurrency: string
  range: ExportRange
  customFrom?: string
  customTo?: string
}

function escapeField(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TxRow {
  type: string
  amount: number
  currency: string
  description: string | null
  date: string
  exchange_rate: number | null
  categories: { name: string; icon: string } | null
}

export async function exportTransactionsCsv(options: ExportOptions): Promise<{
  success: boolean
  error?: string
  rowCount?: number
}> {
  try {
    const { userId, baseCurrency, range, customFrom, customTo } = options

    let query = supabase
      .from('transactions')
      .select('type, amount, currency, description, date, exchange_rate, categories(name, icon)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (range === 'thisMonth') {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const nm = month === 12 ? 1 : month + 1
      const ny = month === 12 ? year + 1 : year
      const end = `${ny}-${String(nm).padStart(2, '0')}-01`
      query = query.gte('date', start).lt('date', end)
    } else if (range === 'custom' && customFrom && customTo) {
      query = query.gte('date', customFrom).lte('date', customTo)
    }

    const { data, error } = await query

    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) return { success: true, rowCount: 0 }

    const rows = (data as TxRow[]).map(tx => {
      const amountBase = tx.exchange_rate != null
        ? tx.amount / tx.exchange_rate
        : tx.amount
      return [
        tx.date,
        tx.type,
        escapeField(tx.categories?.name ?? ''),
        tx.amount.toFixed(2),
        tx.currency,
        tx.exchange_rate != null ? tx.exchange_rate.toFixed(2) : '',
        amountBase.toFixed(2),
        baseCurrency,
        escapeField(tx.description ?? ''),
      ].join(',')
    })

    const header = 'date,type,category_name,amount,currency,exchange_rate,amount_base,base_currency,description'
    const csv = '\uFEFF' + header + '\n' + rows.join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-export-${todayStr()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return { success: true, rowCount: data.length }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
