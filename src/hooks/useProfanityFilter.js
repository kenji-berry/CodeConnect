import { useState, useCallback } from 'react';

export function useProfanityFilter(initialValue = '') {
  const [value, setValue] = useState(initialValue);
  const [containsProfanity, setContainsProfanity] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const onChange = useCallback(async (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Only check if there's actual content
    if (newValue.trim()) {
      setIsChecking(true);
      try {
        const response = await fetch('/api/check-profanity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newValue })
        });
        
        const data = await response.json();
        setContainsProfanity(data.isProfane);
      } catch (error) {
        console.error('Error checking profanity:', error);
      } finally {
        setIsChecking(false);
      }
    } else {
      setContainsProfanity(false);
    }
  }, []);
  
  const cleanText = useCallback(async () => {
    try {
      const response = await fetch('/api/check-profanity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value })
      });
      
      const data = await response.json();
      setValue(data.cleanedText);
      setContainsProfanity(false);
      return data.cleanedText;
    } catch (error) {
      console.error('Error cleaning text:', error);
      return value;
    }
  }, [value]);
  
  return {
    value,
    setValue,
    onChange,
    containsProfanity,
    isChecking,
    cleanText
  };
}