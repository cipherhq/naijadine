import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const accountNumber = searchParams.get('account_number');
    const bankCode = searchParams.get('bank_code');
    const gateway = searchParams.get('gateway');

    if (!accountNumber || !bankCode || !gateway) {
      return NextResponse.json(
        { message: 'account_number, bank_code, and gateway are required' },
        { status: 400 },
      );
    }

    if (!['paystack', 'flutterwave'].includes(gateway)) {
      return NextResponse.json(
        { message: 'gateway must be paystack or flutterwave' },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        { message: 'account_number must be exactly 10 digits' },
        { status: 400 },
      );
    }

    // Mock mode
    if (gateway === 'paystack' && !process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ account_name: 'MOCK ACCOUNT HOLDER' });
    }
    if (gateway === 'flutterwave' && !process.env.FLUTTERWAVE_SECRET_KEY) {
      return NextResponse.json({ account_name: 'MOCK ACCOUNT HOLDER' });
    }

    if (gateway === 'paystack') {
      const res = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        },
      );
      const data = await res.json();

      if (!data.status) {
        return NextResponse.json(
          { message: data.message || 'Could not resolve account' },
          { status: 422 },
        );
      }

      return NextResponse.json({ account_name: data.data.account_name });
    }

    // Flutterwave
    const res = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
      }),
    });
    const data = await res.json();

    if (data.status !== 'success') {
      return NextResponse.json(
        { message: data.message || 'Could not resolve account' },
        { status: 422 },
      );
    }

    return NextResponse.json({ account_name: data.data.account_name });
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
