import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'WhatsApp Automation — DineRoot',
  description:
    'Automate your restaurant bookings with DineRoot WhatsApp bot.',
};

export default function WhatsAppPage() {
  redirect('/pricing');
}
