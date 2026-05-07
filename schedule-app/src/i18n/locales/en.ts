import type { zh } from './zh'

// 把 zh 的字面量类型放宽成 string，再用形状约束 en：
// 既保证 en 与 zh 的 key 完全对齐，又允许 en 的 value 是任意字符串。
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export const en: DeepStringify<typeof zh> = {
  nav: {
    home: 'Home',
    todo: 'To-do',
    calendar: 'Calendar',
    import: 'Add',
    help: 'Help',
    settings: 'Settings',
    settingsDisabled: 'Not available yet',
  },
  header: {
    back: 'Back',
  },
  userMenu: {
    menuLabel: 'User menu',
    currentAccount: 'Signed in as',
    balance: 'Balance',
    redeemInvite: 'Redeem invite code',
    help: 'Help / tutorial',
    notifications: 'Event reminders',
    signOut: 'Sign out',
    language: 'Language',
  },
  offline: {
    label: 'Offline',
    dataUpdatedAt: 'Updated {time}',
    justNow: 'just now',
    secondsAgo: '{n}s ago',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
  },
  theme: {
    toggle: 'Toggle theme',
  },
  help: {
    tutorial: 'Tutorial',
  },
  language: {
    zh: '中文',
    en: 'English',
  },
}
