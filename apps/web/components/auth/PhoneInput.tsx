'use client';

import { useState } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  const [raw, setRaw] = useState(value.replace('+234', ''));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRaw(digits);
    onChange(digits.length === 10 ? `+234${digits}` : '');
  }

  return (
    <div className="flex rounded-lg border border-gray-300 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
      <span className="flex items-center rounded-l-lg bg-gray-50 px-3 text-sm font-medium text-gray-600 border-r border-gray-300">
        +234
      </span>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="8012345678"
        value={raw}
        onChange={handleChange}
        disabled={disabled}
        className="w-full rounded-r-lg px-3 py-3 text-sm outline-none disabled:bg-gray-100"
        maxLength={10}
        autoComplete="tel-national"
      />
    </div>
  );
}
