export type TransactionType = 'expense' | 'income' | 'transfer'

export type Currency =
  | 'MYR' | 'SGD' | 'USD' | 'CNY' | 'HKD'
  | 'JPY' | 'EUR' | 'GBP' | 'THB' | 'KHR' | 'TWD' | 'AUD'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  currency: Currency
  category: string
  note?: string
  date: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  preferred_currency: Currency
  default_currency: Currency
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  category?: string  // undefined = total budget
  amount: number
  currency: Currency
  period: 'monthly' | 'yearly'
  created_at: string
  updated_at: string
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  'CNY', 'MYR', 'SGD', 'USD', 'HKD',
  'JPY', 'EUR', 'GBP', 'THB', 'KHR', 'TWD', 'AUD',
]

export interface TxDetail {
  id: string
  type: string
  amount: number
  currency: string
  description: string | null
  date: string
  category_id: string
  categories: { name: string; icon: string } | null
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥', MYR: 'RM', SGD: 'S$', USD: '$', HKD: 'HK$',
  JPY: '¥', EUR: '€', GBP: '£', THB: '฿', KHR: '₫', TWD: 'NT$', AUD: 'A$',
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  CNY: '人民币 CNY',
  MYR: '马来西亚令吉 MYR',
  SGD: '新加坡元 SGD',
  USD: '美元 USD',
  HKD: '港元 HKD',
  JPY: '日元 JPY',
  EUR: '欧元 EUR',
  GBP: '英镑 GBP',
  THB: '泰铢 THB',
  KHR: '柬埔寨瑞尔 KHR',
  TWD: '新台币 TWD',
  AUD: '澳元 AUD',
}

export const EXPENSE_CATEGORIES = [
  '三餐', '零食', '交通', '旅行', '住房', '日用品', '学习', '娱乐', '医疗',
  '衣服', '话费网费', '汽车/加油', '电器数码', '运动', '美妆', '宠物', '烟酒',
  '请客送礼', '水电煤', '其它',
]

export const INCOME_CATEGORIES = [
  '工资', '奖金', '兼职', '投资', '理财', '红包', '退款', '其它',
]

export const TRANSFER_CATEGORIES = [
  '转账', '还款', '存款',
]

export const CATEGORY_ICONS: Record<string, string> = {
  // Expense
  '三餐': '🍚', '零食': '🍿', '交通': '🚌', '旅行': '✈️', '住房': '🏠',
  '日用品': '🧴', '学习': '📚', '娱乐': '🎮', '医疗': '💊', '衣服': '👕',
  '话费网费': '📱', '汽车/加油': '🚗', '电器数码': '💻', '运动': '⚽',
  '美妆': '💄', '宠物': '🐾', '烟酒': '🍺',
  '请客送礼': '🎁', '水电煤': '💡',
  // Income
  '工资': '💼', '奖金': '🏆', '兼职': '🔧', '投资': '📈', '理财': '💰',
  '红包': '🧧', '退款': '↩️',
  // Transfer
  '转账': '↔️', '还款': '💳', '存款': '🏦',
  '其它': '📦',
}
