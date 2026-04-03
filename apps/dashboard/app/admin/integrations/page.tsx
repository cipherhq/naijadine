'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface WebhookConfig {
  gupshup_webhook_url: string;
  paystack_webhook_url: string;
}

interface IntegrationStatus {
  name: string;
  configured: boolean;
  detail: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AdminIntegrationsPage() {
  const { verified } = useAdminGuard();
  const [webhooks, setWebhooks] = useState<WebhookConfig>({
    gupshup_webhook_url: '',
    paystack_webhook_url: '',
  });
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Fetch webhook config from platform_config
    const { data: configs } = await supabase
      .from('platform_config')
      .select('key, value')
      .in('key', ['gupshup_webhook_url', 'paystack_webhook_url', 'gupshup_app_id', 'gupshup_phone', 'paystack_secret_set', 'resend_api_set']);

    const configMap = new Map<string, string>();
    (configs || []).forEach((c) => configMap.set(c.key, c.value));

    setWebhooks({
      gupshup_webhook_url: configMap.get('gupshup_webhook_url') || '',
      paystack_webhook_url: configMap.get('paystack_webhook_url') || '',
    });

    // Build integration status
    setIntegrations([
      {
        name: 'Gupshup (WhatsApp)',
        configured: !!(configMap.get('gupshup_app_id') || configMap.get('gupshup_phone')),
        detail: configMap.get('gupshup_app_id')
          ? `App: ${configMap.get('gupshup_app_id')}, Phone: ${configMap.get('gupshup_phone') || 'not set'}`
          : 'Not configured',
      },
      {
        name: 'Paystack',
        configured: configMap.get('paystack_secret_set') === 'true',
        detail: configMap.get('paystack_secret_set') === 'true' ? 'Secret key configured' : 'Secret key not set',
      },
      {
        name: 'Resend (Email)',
        configured: configMap.get('resend_api_set') === 'true',
        detail: configMap.get('resend_api_set') === 'true' ? 'API key configured' : 'API key not set',
      },
    ]);

    // Fetch recent integration-related audit logs
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('id, action, entity_type, details, created_at')
      .or('action.ilike.%webhook%,action.ilike.%whatsapp%,action.ilike.%gupshup%,action.ilike.%paystack%,action.ilike.%integration%')
      .order('created_at', { ascending: false })
      .limit(50);

    setAuditLogs((logs || []) as AuditEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (verified) fetchData();
  }, [fetchData, verified]);

  async function saveWebhooks() {
    setSaving(true);
    const supabase = createClient();

    for (const [key, value] of Object.entries(webhooks)) {
      await supabase
        .from('platform_config')
        .upsert({ key, value }, { onConflict: 'key' });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('audit_logs').insert({
        action: 'webhook_urls_updated',
        entity_type: 'platform_config',
        entity_id: 'webhooks',
        user_id: user.id,
        details: webhooks,
      });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!verified || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
      <p className="mt-1 text-sm text-gray-500">Manage webhook endpoints and integration status</p>

      {/* ─── Webhook Endpoints ─── */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Webhook Endpoints</h2>
        <p className="mt-1 text-xs text-gray-400">URLs for receiving inbound events from third-party services</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Gupshup Inbound Webhook</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={webhooks.gupshup_webhook_url}
                onChange={(e) => setWebhooks({ ...webhooks, gupshup_webhook_url: e.target.value })}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={() => copyToClipboard(webhooks.gupshup_webhook_url, 'gupshup')}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {copied === 'gupshup' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Paystack Webhook</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={webhooks.paystack_webhook_url}
                onChange={(e) => setWebhooks({ ...webhooks, paystack_webhook_url: e.target.value })}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={() => copyToClipboard(webhooks.paystack_webhook_url, 'paystack')}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {copied === 'paystack' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveWebhooks}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Webhooks'}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>

      {/* ─── Integration Status ─── */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Integration Status</h2>
        <p className="mt-1 text-xs text-gray-400">Health check for connected services</p>

        <div className="mt-4 divide-y divide-gray-50">
          {integrations.map((integ) => (
            <div key={integ.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${integ.configured ? 'bg-green-500' : 'bg-red-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{integ.name}</p>
                  <p className="text-xs text-gray-400">{integ.detail}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                integ.configured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {integ.configured ? 'Connected' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Activity Log ─── */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Integration Activity</h2>
        <p className="mt-1 text-xs text-gray-400">Recent webhook and integration events</p>

        {auditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No integration activity found</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-50">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-700">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-gray-400">
                    {log.entity_type} {log.details ? `— ${JSON.stringify(log.details).slice(0, 80)}` : ''}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[10px] text-gray-400">
                  {new Date(log.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
