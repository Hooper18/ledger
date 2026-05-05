import { useEffect, useState } from 'react'

/**
 * Tracks browser online status via navigator.onLine + the online/offline events.
 *
 * navigator.onLine can occasionally lie (captive portals, VPN reconnect),
 * but it's a good-enough hint for showing the offline banner and toggling
 * write affordances. Mutations that fail at the network layer still surface
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
