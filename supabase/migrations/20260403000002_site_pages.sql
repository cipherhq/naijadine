-- CMS-editable site pages (terms, privacy, about, etc.)
CREATE TABLE IF NOT EXISTS public.site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  meta_description TEXT,
  product TEXT NOT NULL DEFAULT 'naijadine' CHECK (product IN ('naijadine', 'blowded', 'both')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read published pages
CREATE POLICY "Anyone can read published pages"
  ON public.site_pages FOR SELECT
  USING (is_published = true);

-- Only admins can manage pages
CREATE POLICY "Admins can manage pages"
  ON public.site_pages FOR ALL
  USING (public.is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_site_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_site_pages_updated
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_site_pages_updated_at();

-- Seed with existing content
INSERT INTO public.site_pages (slug, title, content, meta_description, product) VALUES
(
  'terms',
  'Terms of Service',
  E'## 1. Acceptance of Terms\n\nBy accessing or using DineRoot ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.\n\n## 2. Our Service\n\nDineRoot provides a platform for discovering restaurants and making reservations in Nigeria. We act as an intermediary between diners and restaurants. We do not operate any restaurants ourselves.\n\n## 3. Account Registration\n\nTo make reservations, you must create an account with accurate information. You are responsible for maintaining the security of your account and for all activities under your account. You must be at least 18 years old to create an account.\n\n## 4. Reservations\n\n- Reservations are subject to availability and restaurant confirmation.\n- You agree to honour your reservations or cancel within the restaurant''s cancellation window.\n- Repeated no-shows may result in account suspension.\n- Some restaurants require a deposit to secure your booking. Deposits are processed securely via Paystack.\n\n## 5. Deposits & Payments\n\n- Deposits are collected on behalf of restaurants and are applied to your dining bill.\n- Cancellations made within the restaurant''s cancellation window are eligible for a full refund.\n- Late cancellations or no-shows may result in deposit forfeiture, at the restaurant''s discretion.\n- Refunds are processed within 5-10 business days to your original payment method.\n\n## 6. User Conduct\n\nYou agree not to:\n\n- Provide false or misleading information.\n- Use the platform for any unlawful purpose.\n- Attempt to access other users'' accounts or data.\n- Submit abusive, offensive, or spam content in reviews or messages.\n- Interfere with the platform''s operation or security.\n\n## 7. Reviews\n\nBy submitting a review, you grant DineRoot a non-exclusive licence to display your review on our platform. Reviews must be honest, based on genuine dining experiences, and free of offensive content. We reserve the right to moderate or remove reviews that violate these guidelines.\n\n## 8. Restaurant Partners\n\nRestaurant information, including menus, photos, and prices, is provided by the restaurants themselves. While we strive for accuracy, DineRoot is not responsible for the accuracy of restaurant-provided content or the quality of dining experiences.\n\n## 9. Limitation of Liability\n\nDineRoot is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform, including but not limited to dining experiences, payment disputes, or service interruptions.\n\n## 10. Changes to Terms\n\nWe may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms. We will notify you of significant changes via email or platform notification.\n\n## 11. Governing Law\n\nThese terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos, Nigeria.\n\n## 12. Contact\n\nFor questions about these terms, contact us at legal@dineroot.com.',
  'DineRoot terms of service — the rules and guidelines for using our platform.',
  'naijadine'
),
(
  'privacy',
  'Privacy Policy',
  E'## 1. Information We Collect\n\nWhen you use DineRoot, we may collect the following information:\n\n- **Account information:** name, email address, phone number, and city.\n- **Booking information:** restaurant, date, time, party size, special requests, and payment details.\n- **Usage data:** pages visited, features used, and interaction patterns to improve our service.\n- **Device information:** browser type, operating system, and IP address.\n\n## 2. How We Use Your Information\n\nWe use your information to:\n\n- Process and manage your restaurant reservations.\n- Send booking confirmations, reminders, and updates via email, SMS, or WhatsApp.\n- Improve our platform, features, and user experience.\n- Communicate with you about your account and our services.\n- Process payments and deposits securely through our payment providers.\n- Prevent fraud, abuse, and enforce our terms of service.\n\n## 3. Information Sharing\n\nWe share your information only as necessary to provide our services:\n\n- **Restaurants:** your name, phone number, party size, and special requests are shared with the restaurant when you make a booking.\n- **Payment processors:** payment information is securely handled by Paystack. We do not store your full card details.\n- **Service providers:** we use trusted providers for email delivery, SMS, and hosting.\n\nWe do not sell your personal information to third parties.\n\n## 4. Data Security\n\nWe implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure authentication, and access controls. However, no method of transmission over the internet is 100% secure.\n\n## 5. Your Rights\n\nYou have the right to:\n\n- Access and review the personal information we hold about you.\n- Update or correct your information through your account settings.\n- Request deletion of your account and associated data.\n- Opt out of marketing communications at any time.\n\n## 6. Cookies\n\nWe use essential cookies to keep you signed in and maintain your session. We may also use analytics cookies to understand how our platform is used. You can control cookies through your browser settings.\n\n## 7. Changes to This Policy\n\nWe may update this privacy policy from time to time. We will notify you of any significant changes by posting a notice on our platform or sending you an email.\n\n## 8. Contact Us\n\nIf you have questions about this privacy policy or your personal data, please contact us at privacy@dineroot.com.',
  'DineRoot privacy policy — how we collect, use, and protect your personal information.',
  'naijadine'
),
(
  'about',
  'About Us',
  E'## Our Mission\n\nDineRoot is Nigeria''s premier restaurant discovery and reservation platform. We connect diners with the best restaurants across Lagos, Abuja, and Port Harcourt, making it effortless to find and book a table at your perfect dining spot.\n\n## What We Offer\n\n### For Diners\n\n- Browse restaurants by cuisine, location, and price\n- Book tables instantly online or via WhatsApp\n- Access exclusive deals and promotions\n- Manage your reservations in one place\n\n### For Restaurants\n\n- Reach new customers across Nigeria\n- Manage reservations with a powerful dashboard\n- Accept bookings via web, WhatsApp, and phone\n- Reduce no-shows with deposit collection\n\n## Our Cities\n\nWe''re currently live in Lagos, Abuja, and Port Harcourt, with plans to expand to more cities across Nigeria. From fine dining to beloved local spots, we curate the best dining experiences in every city we serve.\n\n## Get in Touch\n\nHave questions or want to partner with us? Contact our team at hello@dineroot.com.',
  'Learn about DineRoot — Nigeria''s premier restaurant discovery and reservation platform.',
  'naijadine'
),
(
  'refund-policy',
  'Refund Policy',
  E'## Refund Policy\n\nAt DineRoot, we want every dining experience to be exceptional. Here is our refund policy for deposits and payments made through our platform.\n\n## Cancellation Refunds\n\n- **Within cancellation window:** Cancellations made within the restaurant''s specified cancellation window are eligible for a full refund of any deposit paid.\n- **Late cancellations:** Cancellations made after the cancellation window may not be eligible for a refund, at the restaurant''s discretion.\n\n## No-Show Policy\n\n- If you do not show up for your reservation without cancelling, the deposit may be forfeited.\n- Repeated no-shows may result in account restrictions.\n\n## Refund Processing\n\n- Approved refunds are processed within 5-10 business days.\n- Refunds are returned to your original payment method.\n- You will receive an email confirmation when your refund is processed.\n\n## Disputes\n\nIf you believe a refund decision was made in error, please contact our support team at support@dineroot.com and we will review your case within 48 hours.\n\n## Contact\n\nFor refund-related questions, reach out to support@dineroot.com.',
  'DineRoot refund policy — how deposits and payment refunds work.',
  'naijadine'
);
