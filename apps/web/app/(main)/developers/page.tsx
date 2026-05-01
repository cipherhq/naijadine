import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer API — DineRoot',
  description: 'DineRoot API documentation for third-party integrations',
};

const endpoints = [
  { method: 'GET', path: '/api/v1/search?q=&city=&cuisine=', desc: 'Search restaurants', auth: 'Public' },
  { method: 'GET', path: '/api/v1/restaurants/:slug', desc: 'Get restaurant details', auth: 'Public' },
  { method: 'GET', path: '/api/v1/reviews/restaurant/:id', desc: 'Get restaurant reviews', auth: 'Public' },
  { method: 'GET', path: '/api/v1/flags/:key', desc: 'Check feature flag', auth: 'Public' },
  { method: 'POST', path: '/api/v1/reservations', desc: 'Create reservation', auth: 'Bearer Token' },
  { method: 'GET', path: '/api/v1/reservations/:ref', desc: 'Get reservation', auth: 'Bearer Token' },
  { method: 'PUT', path: '/api/v1/reservations/:id/modify', desc: 'Modify reservation', auth: 'Bearer Token' },
  { method: 'POST', path: '/api/v1/reservations/:id/cancel', desc: 'Cancel reservation', auth: 'Bearer Token' },
  { method: 'GET', path: '/api/v1/orders', desc: 'Get user orders', auth: 'Bearer Token' },
  { method: 'GET', path: '/api/v1/analytics/restaurant/:id', desc: 'Restaurant analytics', auth: 'Bearer Token' },
  { method: 'GET', path: '/api/v1/analytics/restaurant/:id/insights', desc: 'Actionable insights', auth: 'Bearer Token' },
  { method: 'GET', path: '/api/v1/widget/:slug', desc: 'Widget data (CORS-enabled)', auth: 'Public' },
  { method: 'GET', path: '/api/v1/campaigns/featured', desc: 'Featured restaurants', auth: 'Public' },
];

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">DineRoot API</h1>
      <p className="mt-2 text-gray-500">
        Integrate DineRoot into your app, website, or service. All endpoints return JSON.
      </p>

      <div className="mt-4 rounded-lg bg-brand-50 border border-brand-200 p-4 text-sm text-brand-800">
        <strong>Base URL:</strong> <code className="rounded bg-white px-2 py-0.5">https://api.dineroot.com/api/v1</code>
        <br />
        <strong>Auth:</strong> Include <code className="rounded bg-white px-2 py-0.5">Authorization: Bearer YOUR_TOKEN</code> for authenticated endpoints.
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Endpoints</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Method</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Endpoint</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Auth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {endpoints.map((ep, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                      ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{ep.method}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{ep.path}</td>
                  <td className="px-4 py-3 text-gray-600">{ep.desc}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      ep.auth === 'Public' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                    }`}>{ep.auth}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Embed Widget</h2>
        <p className="mt-2 text-gray-500">Add a booking widget to any website with one line of code:</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
{`<div id="dineroot-widget" data-restaurant="your-restaurant-slug"></div>
<script src="https://dineroot.com/widget/embed.js"></script>`}
        </pre>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center">
        <h3 className="font-semibold text-gray-900">Need API access?</h3>
        <p className="mt-1 text-sm text-gray-500">Contact us to get your API key and rate limits.</p>
        <a href="/contact" className="mt-3 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Contact Us
        </a>
      </div>
    </div>
  );
}
