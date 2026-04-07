'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import enMessages from '../messages/en.json';
import siMessages from '../messages/si.json';

type Messages = typeof enMessages;
type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : `${K}`) : never }[keyof T]
  : never;

type TranslationKey = NestedKeyOf<Messages>;

const messages: Record<string, Messages> = {
  en: enMessages,
  si: siMessages,
};

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('nipuna-locale');
    if (saved && (saved === 'en' || saved === 'si')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem('nipuna-locale', newLocale);
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let result: any = messages[locale];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        return key;
      }
    }
    return typeof result === 'string' ? result : key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
