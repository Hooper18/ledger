// 中文词典：作为 i18n key 的「单一事实源」。
// en.ts 必须保持完全相同的形状，类型系统会强制对齐。
export const zh = {
  nav: {
    home: '首页',
    todo: '待办',
    calendar: '日历',
    import: '添加',
    help: '帮助',
    settings: '设置',
    settingsDisabled: '暂未开放',
  },
  header: {
    back: '返回',
  },
  userMenu: {
    menuLabel: '用户菜单',
    currentAccount: '当前账号',
    balance: '余额',
    redeemInvite: '兑换邀请码',
    help: '帮助 / 教程',
    notifications: '事件提醒',
    signOut: '登出',
    language: '语言',
  },
  offline: {
    label: '离线',
    dataUpdatedAt: '数据更新于 {time}',
    justNow: '刚刚',
    secondsAgo: '{n} 秒前',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
  },
  theme: {
    toggle: '切换主题',
  },
  help: {
    tutorial: '使用教程',
  },
  language: {
    zh: '中文',
    en: 'English',
  },
} as const
