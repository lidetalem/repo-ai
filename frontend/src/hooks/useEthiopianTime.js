import { useState, useEffect } from 'react'
import { formatEthiopianDateTime } from '../utils/ethiopianTime'
import { useLang } from '../context/LanguageContext'

export function useEthiopianTime() {
  const { lang } = useLang()
  const [currentTime, setCurrentTime] = useState(() => formatEthiopianDateTime(new Date(), lang))

  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(formatEthiopianDateTime(new Date(), lang)), 1000)
    return () => clearInterval(iv)
  }, [lang])

  return currentTime
}

// Legacy default export for backward compat
export const useEthiopianTimeLegacy = useEthiopianTime
export default useEthiopianTime