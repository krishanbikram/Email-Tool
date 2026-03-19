import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Mail, Send, MousePointerClick, AlertTriangle, Globe, Users, TrendingUp } from 'lucide-react'
import api from '../lib/api'
import { Link } from 'react-router-dom'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-slate-200">{p.value}</span></p>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
  })
  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/domains').then(r => r.data),
  })
  const { data: lists } = useQuery({
    queryKey: ['contact-lists'],
    queryFn: () => api.get('/contacts/lists').then(r => r.data),
  })
  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  })
  const { data: trendRaw } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => api.get('/analytics/dashboard?days=7').then(r => r.data),
    refetchInterval: 60000,
  })

  const totalContacts = overview?.totalContacts ?? lists?.reduce((a: number, l: any) => a + (l._count?.contacts || 0), 0) ?? 0
  const activeCampaigns = campaigns?.data?.filter((c: any) => c.status === 'SENDING').length || 0
  const activeDomains = domains?.filter((d: any) => d.isActive).length || 0
  const totalSent = overview?.totalSent ?? 0

  const trendData = (trendRaw || []).map((d: any) => ({ ...d, day: d.day }))

  const recentCampaigns = campaigns?.data?.slice(0, 5) || []

  const statusColor: Record<string, string> = {
    DRAFT: 'badge-slate', SCHEDULED: 'badge-yellow', SENDING: 'badge-blue',
    SENT: 'badge-green', FAILED: 'badge-red', PAUSED: 'badge-yellow',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Overview of your email platform</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Mail size={15} /> New Campaign
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-brand-400', glow: 'from-brand-500/10' },
          { label: 'Active Campaigns', value: activeCampaigns, icon: TrendingUp, color: 'text-blue-400', glow: 'from-blue-500/10' },
          { label: 'Active Domains', value: activeDomains, icon: Globe, color: 'text-purple-400', glow: 'from-purple-500/10' },
          { label: 'Total Contacts', value: totalContacts.toLocaleString(), icon: Users, color: 'text-orange-400', glow: 'from-orange-500/10' },
        ].map(({ label, value, icon: Icon, color, glow }) => (
          <div key={label} className="stat-card relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${glow} to-transparent pointer-events-none`} />
            <div className="relative z-10">
              <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center mb-3 ${color}`}>
                <Icon size={16} />
              </div>
              <div className="stat-number">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="section-title mb-4">Email Activity (7 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="sent" stroke="#22c55e" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} dot={false} name="Opened" />
              <Line type="monotone" dataKey="clicked" stroke="#f59e0b" strokeWidth={2} dot={false} name="Clicked" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[['Sent','#22c55e'],['Opened','#3b82f6'],['Clicked','#f59e0b']].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Domain Activity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(domains || []).slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="domain" type="category" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalSent" fill="#22c55e" radius={[0,4,4,0]} name="Total Sent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent campaigns */}
      <div className="card">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="section-title">Recent Campaigns</h3>
          <Link to="/campaigns" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
        <div className="table-wrapper rounded-none border-0">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">No campaigns yet — <Link to="/campaigns/new" className="text-brand-400 hover:underline">create one</Link></td></tr>
              ) : recentCampaigns.map((c: any) => (
                <tr key={c.id}>
                  <td><span className="font-medium text-slate-200">{c.name}</span></td>
                  <td>{c.domain?.domain || '—'}</td>
                  <td><span className={statusColor[c.status] || 'badge-slate'}>{c.status}</span></td>
                  <td className="text-slate-400 text-xs">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'Immediate'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
