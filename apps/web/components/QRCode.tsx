'use client';

import { QRCodeSVG } from 'qrcode.react';

export function BookingQRCode({ referenceCode }: { referenceCode: string }) {
  const checkInUrl = `https://dineroot.com/checkin/${referenceCode}`;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-6">
      <p className="text-xs font-medium text-gray-500">Scan to check in</p>
      <QRCodeSVG
        value={checkInUrl}
        size={160}
        level="M"
        bgColor="transparent"
        fgColor="#111827"
      />
      <p className="text-[10px] text-gray-400">{referenceCode}</p>
    </div>
  );
}
