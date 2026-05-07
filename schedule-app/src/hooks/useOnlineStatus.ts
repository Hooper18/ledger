import { useEffect, useState } from 'react'

/**
 * 默认乐观假设在线 —— Capacitor Android WebView 的 `navigator.onLine` 经常
 * 错报 false（即便 OS 实际有网，且 app 是远程加载的），把读 navigator.onLine
 * 当作初始 state 会导致写操作按钮一直禁用。
 *
 * 策略：
 *  - 初始 true（如果 app 真的是离线启动，supabase 请求会自己失败给出错误）
 *  - 监听 window `offline` 事件 → 翻 false
 *  - 监听 window `online` 事件 → 翻回 true
 *
 * 副作用可接受：极少数情况下用户真离线但 button 仍可点，点了之后会看到
 * supabase 报的网络错误（比 false-positive 阻塞写入要好得多）。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true)

  useEffect(() => {
    // 挂载时再 sync 一次：如果浏览器明确说 offline 才信，否则保持 true。
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // 给 WebView 一拍时间稳定状态 —— 启动瞬间的 onLine 经常是 stale
      const t = window.setTimeout(() => {
        if (navigator.onLine === false) setOnline(false)
      }, 1500)
      return () => window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
