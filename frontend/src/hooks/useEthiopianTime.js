import { useState, useEffect } from 'react';
import { formatEthiopianDateTime } from '../utils/ethiopianTime';
import { useLanguage } from '../context/LanguageContext';

export const useEthiopianTime = () => {
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(formatEthiopianDateTime(new Date(), language));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatEthiopianDateTime(new Date(), language));
    }, 1000);

    return () => clearInterval(timer);
  }, [language]);

  return currentTime;
};