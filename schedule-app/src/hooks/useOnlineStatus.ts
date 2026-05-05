import { useEffect, useState } from 'react'

/**
 * Tracks browser online status via navigator.onLine + the online/offline events.
 *
 * navigator.onLine can occasionally lie (e.g. captive portals, VPN reconnect),
 * but for the purposes of this app — telling the user the network appears down
 * and toggling write affordances — it is good enough. Treat it as a hint, not
 * a guarantee; mutations that fail at the network layer will still surface
 * normal Supabase errors regardless.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

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
