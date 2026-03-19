import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Plus, Trash2, Eye, EyeOff, Key } from 'lucide-react'
import api from '../lib/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyVal, setNewKeyVal] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const { data: keysData, refetch: refetchKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/auth/api-keys').then(r => r.data),
  })

  useEffect(() => { if (settingsData) setSettings(settingsData) }, [settingsData])
  useEffect(() => { if (keysData) setApiKeys(keysData) }, [keysData])

  const saveMutation = useMutation({
    mutationFn: () => api.put('/settings', settings),
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save settings'),
  })

  const createKey = async () => {
    if (!newKeyLabel.trim()) { toast.error('Enter a label'); return }
    try {
      const { data } = await api.post('/auth/api-keys', { label: newKeyLabel })
      setNewKeyVal(data.key)
      setNewKeyLabel('')
      refetchKeys()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create key')
    }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key?')) return
    await api.delete(`/auth/api-keys/${id}`)
    refetchKeys()
    toast.success('API key revoked')
  }

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Global platform configuration</p>
      </div>

      {/* Global settings */}
      <div className="card p-6 space-y-5">
        <h3 className="section-title">Email Configuration</h3>

        <div>
          <label className="label">Unsubscribe Footer HTML</label>
          <p className="text-xs text-slate-500 mb-1.5">Appended to every outgoing email. Use <code className="bg-slate-800 px-1 rounded">{'{{unsubscribe_url}}'}</code></p>
          <textarea className="input min-h-[80px] font-mono text-xs" value={settings.unsubscribe_footer || ''} onChange={f('unsubscribe_footer')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Log Retention (days)</label>
            <input type="number" className="input" value={settings.log_retention_days || '30'} onChange={f('log_retention_days')} />
          </div>
          <div>
            <label className="label">Bounce Alert Threshold (%)</label>
            <input type="number" min="0" max="100" step="0.5" className="input" value={settings.bounce_alert_threshold || '2'} onChange={f('bounce_alert_threshold')} />
            <p className="text-xs text-slate-500 mt-1">Alert admin if bounce rate exceeds this %</p>
          </div>
          <div>
            <label className="label">Admin Notification Email</label>
            <input type="email" className="input" placeholder="admin@example.com" value={settings.admin_notify_email || ''} onChange={f('admin_notify_email')} />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={() => saveMutation.mutate()} className="btn-primary" disabled={saveMutation.isPending} id="save-settings-btn">
            <Save size={15} /> {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="card p-6 space-y-4">
        <h3 className="section-title">API Keys</h3>
        <p className="text-xs text-slate-400">Use API keys to access the platform programmatically. Keys are shown only once after creation.</p>

        {/* New key that was just created */}
        {newKeyVal && (
          <div className="bg-brand-900/30 border border-brand-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-400">✓ New API Key — Save it now, it won't be shown again</span>
              <button onClick={() => setShowKey(!showKey)} className="btn-ghost p-1 text-slate-400"><Eye size={13} /></button>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-slate-900 border border-slate-700 rounded px-3 py-2 flex-1 break-all">
                {showKey ? newKeyVal : '•'.repeat(newKeyVal.length)}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(newKeyVal); toast.success('Copied') }} className="btn-secondary text-xs">Copy</button>
            </div>
            <button onClick={() => setNewKeyVal(null)} className="text-xs text-slate-500 hover:text-slate-300 mt-2">Dismiss</button>
          </div>
        )}

        <div className="flex gap-2">
          <input className="input text-sm" placeholder="Key label (e.g. Production)" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createKey()} />
          <button onClick={createKey} className="btn-primary flex-shrink-0" id="create-api-key-btn"><Plus size={14} /> Create Key</button>
        </div>

        {apiKeys.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Label</th><th>Prefix</th><th>Last Used</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {apiKeys.map((k: any) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.label || '—'}</td>
                    <td><code className="text-xs font-mono text-slate-400">{k.prefix}…</code></td>
                    <td className="text-xs text-slate-400">{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : 'Never'}</td>
                    <td className="text-xs text-slate-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td><button onClick={() => revokeKey(k.id)} className="btn-ghost p-1 text-red-400 hover:text-red-300"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance info */}
      <div className="card p-5 border-slate-700">
        <h3 className="section-title mb-3">Compliance Links</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            ['Google Postmaster Tools', 'https://postmaster.google.com'],
            ['MXToolbox SMTP Test', 'https://mxtoolbox.com/emailhealth'],
            ['Mail Tester Spam Score', 'https://www.mail-tester.com'],
            ['DMARC Analyzer', 'https://dmarcian.com/dmarc-check'],
          ].map(([label, url]) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300">
              <Key size={11} /> {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
