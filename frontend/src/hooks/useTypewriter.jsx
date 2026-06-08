import { useState, useEffect } from 'react';

export const useTypewriter = (words, typingSpeed = 150, deletingSpeed = 100, pauseTime = 1500) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    // Handle Deletion
    if (reverse && subIndex === 0) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    // Handle Completion of typing
    if (!reverse && subIndex === words[index].length + 1) {
      setIsPaused(true);
      setTimeout(() => {
        setIsPaused(false);
        setReverse(true);
      }, pauseTime);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, reverse ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse, isPaused, words, typingSpeed, deletingSpeed, pauseTime]);

  return words[index].substring(0, subIndex);
};