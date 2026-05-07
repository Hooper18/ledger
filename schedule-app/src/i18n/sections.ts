// 把字典里的 key 分到几个"类别"，让用户可以对每个类别独立选语言。
// 例如把"事件类型 chip"设成英文（DDL/Exam 紧凑），其他文字保持中文。
//
// 不在分类里的 key 直接走"主语言"。
//
// 用 pattern 而不是手维护 key 集合 —— 字典加新 key 时自动归类，避免
// "新加的类型 chip 忘了加进列表"这种回归。
import type { TKey } from './LocaleContext'

export type Section = 'types' | 'nav' | 'actions'

// 事件类型（chip / 筛选 / Moodle 徽章 label）
//   - 形如 `*.typeXxx`（typeDdl / typeExam / typePersonal …）
//   - filters.* （筛选 chip 也是 type 标签的一种展现）
function isTypeKey(key: string): boolean {
  if (/\.type[A-Z]/.test(key)) return true
  if (key.startsWith('filters.')) return true
  return false
}

// 导航与页面标题
//   - nav.*（首页/待办/日历/添加/帮助/设置）
//   - header.*（返回 aria）
//   - *.pageTitle（页面层级的标题）
function isNavKey(key: string): boolean {
  if (key.startsWith('nav.')) return true
  if (key.startsWith('header.')) return true
  if (key.endsWith('.pageTitle')) return true
  return false
}

// 操作按钮（保存/取消/删除/确认/提交…）
//   - 以 .save / .cancel / .confirm / .delete / .deleteBtn / .submit /
//     .confirmDelete 等结尾的 key
//   - 通用的 conflict.* 三组（cancel/append/replace）
//   - common.cancel / .confirm / .save / .close
function isActionKey(key: string): boolean {
  if (key.startsWith('conflict.')) return true
  if (key.startsWith('common.')) return true
  if (
    /\.(save|cancel|confirm|confirmDelete|delete|deleteBtn|submit|backToSignin|signin|signup|done)$/.test(
      key,
    )
  )
    return true
  return false
}

export function sectionOf(key: TKey): Section | null {
  const k = key as string
  if (isTypeKey(k)) return 'types'
  if (isNavKey(k)) return 'nav'
  if (isActionKey(k)) return 'actions'
  return null
}

export type SectionLocale = 'zh' | 'en' | 'auto'
export type SectionOverrides = Record<Section, SectionLocale>

export const DEFAULT_SECTION_OVERRIDES: SectionOverrides = {
  types: 'auto',
  nav: 'auto',
  actions: 'auto',
}

const STORAGE_KEY = 'schedule-locale-sections'

export function readSectionOverrides(): SectionOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SECTION_OVERRIDES
    const parsed = JSON.parse(raw) as Partial<SectionOverrides>
    return {
      types: parsed.types ?? 'auto',
      nav: parsed.nav ?? 'auto',
      actions: parsed.actions ?? 'auto',
    }
  } catch {
    return DEFAULT_SECTION_OVERRIDES
  }
}

export function writeSectionOverrides(overrides: SectionOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // 隐私模式 / 配额满：当前会话生效，下次回到默认，可接受
  }
}
