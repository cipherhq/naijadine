'use client';

import { useState } from 'react';
import { LOCALES, type Locale } from '@dineroot/shared';

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Locale>('en');

  function selectLocale(locale: Locale) {
    setCurrent(locale);
    setOpen(false);
    // Store preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineroot_locale', locale);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
        aria-label="Change language"
        aria-expanded={open}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        {LOCALES[current].native}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            {(Object.entries(LOCALES) as [Locale, { name: string; native: string }][]).map(
              ([key, { name, native }]) => (
                <button
                  key={key}
                  onClick={() => selectLocale(key)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
                    current === key ? 'font-medium text-brand' : 'text-gray-700'
                  }`}
                >
                  <span>{native}</span>
                  <span className="text-xs text-gray-400">{name}</span>
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
