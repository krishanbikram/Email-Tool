import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mail, MousePointerClick, Eye, AlertTriangle, UserX, XCircle } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import api from '../lib/api'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#64748b']

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

export default function CampaignStatsPage() {
  const { id } = useParams()

  const { data: campaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/campaigns/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: stats, isLoading } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => api.get(`/campaigns/${id}/stats`).then(r => r.data),
    enabled: !!id,
    refetchInterval: 15000,
  })

  const statusColor: Record<string, string> = {
    DRAFT: 'badge-slate', SCHEDULED: 'badge-yellow', SENDING: 'badge-blue',
    SENT: 'badge-green', FAILED: 'badge-red', PAUSED: 'badge-yellow',
  }

  const pieData = stats ? [
    { name: 'Opened', value: stats.opened },
    { name: 'Clicked', value: stats.clicked },
    { name: 'Bounced', value: stats.bounced },
    { name: 'Unsubscribed', value: stats.unsubscribed },
    { name: 'Failed', value: stats.failed },
    { name: 'Not Opened', value: Math.max(0, stats.sent - stats.opened - stats.bounced - stats.failed - stats.unsubscribed) },
  ].filter(d => d.value > 0) : []

  const barData = stats ? [
    { label: 'Sent', value: stats.sent, fill: '#22c55e' },
    { label: 'Delivered', value: stats.delivered, fill: '#3b82f6' },
    { label: 'Opened', value: stats.opened, fill: '#a855f7' },
    { label: 'Clicked', value: stats.clicked, fill: '#f59e0b' },
    { label: 'Bounced', value: stats.bounced, fill: '#ef4444' },
    { label: 'Failed', value: stats.failed, fill: '#64748b' },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="btn-ghost p-1.5"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="page-title">{campaign?.name || 'Campaign Stats'}</h1>
            {campaign && <span className={statusColor[campaign.status] || 'badge-slate'}>{campaign.status}</span>}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {campaign?.subject} {campaign?.domain?.domain && `· ${campaign.domain.domain}`}
          </p>
        </div>
        {campaign && ['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
          <Link to={`/campaigns/${id}/edit`} className="btn-secondary text-sm">Edit Campaign</Link>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading stats…</div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Sent', value: stats.sent, icon: Mail, color: 'text-green-400' },
              { label: 'Delivered', value: stats.delivered, icon: Mail, color: 'text-blue-400' },
              { label: 'Opened', value: stats.opened, icon: Eye, color: 'text-purple-400', rate: stats.openRate + '%' },
              { label: 'Clicked', value: stats.clicked, icon: MousePointerClick, color: 'text-yellow-400', rate: stats.clickRate + '%' },
              { label: 'Bounced', value: stats.bounced, icon: AlertTriangle, color: 'text-red-400', rate: stats.bounceRate + '%' },
              { label: 'Unsub', value: stats.unsubscribed, icon: UserX, color: 'text-slate-400' },
            ].map(({ label, value, icon: Icon, color, rate }) => (
              <div key={label} className="stat-card">
                <div className={`w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center mb-2 ${color}`}>
                  <Icon size={14} />
                </div>
                <div className="stat-number text-xl">{value.toLocaleString()}</div>
                <div className="stat-label">{label}</div>
                {rate && <div className={`text-xs font-semibold mt-0.5 ${color}`}>{rate}</div>}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel bar */}
            <div className="card p-5">
              <h3 className="section-title mb-4">Delivery Funnel</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="label" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie breakdown */}
            <div className="card p-5">
              <h3 className="section-title mb-4">Engagement Breakdown</h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: any, name: any) => [val.toLocaleString(), name]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
                  <XCircle size={32} className="mb-2 text-slate-700" />
                  No engagement data yet
                </div>
              )}
            </div>
          </div>

          {/* Rate summary */}
          <div className="card p-5">
            <h3 className="section-title mb-4">Rate Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Open Rate', rate: parseFloat(stats.openRate), color: 'bg-purple-500' },
                { label: 'Click Rate', rate: parseFloat(stats.clickRate), color: 'bg-yellow-500' },
                { label: 'Bounce Rate', rate: parseFloat(stats.bounceRate), color: 'bg-red-500' },
              ].map(({ label, rate, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-semibold text-slate-100">{rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center text-slate-500">No stats available</div>
      )}
    </div>
  )
}
