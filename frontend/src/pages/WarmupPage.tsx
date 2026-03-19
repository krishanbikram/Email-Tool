import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Thermometer, Play, Pause, Zap } from 'lucide-react'
import api from '../lib/api'
import { WARMUP_SCHEDULE } from '../lib/warmupSchedule'

export default function WarmupPage() {
  const qc = useQueryClient()

  const { data: domains, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/domains').then(r => r.data),
  })

  const updateDomain = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api.put(`/domains/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domains'] }); toast.success('Warmup updated') },
  })

  const toggleWarmup = (d: any) => {
    const warmupEnabled = !d.warmupEnabled
    updateDomain.mutate({
      id: d.id,
      data: { warmupEnabled, warmupStartDate: warmupEnabled ? new Date().toISOString() : null },
    })
  }

  const weeks = Object.keys(WARMUP_SCHEDULE).map(Number)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Warmup Engine</h1>
        <p className="text-sm text-slate-400 mt-0.5">Gradually ramp up your sending volume for better deliverability</p>
      </div>

      {/* Warmup ramp chart */}
      <div className="card p-5">
        <h3 className="section-title mb-4">Default Warmup Ramp Schedule</h3>
        <div className="flex items-end gap-3 h-32">
          {weeks.map(w => {
            const limit = WARMUP_SCHEDULE[w]
            const maxLimit = WARMUP_SCHEDULE[Math.max(...weeks)]
            const height = Math.round((limit / maxLimit) * 100)
            return (
              <div key={w} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 font-semibold">{limit.toLocaleString()}</span>
                <div className="w-full rounded-t-md" style={{ height: `${height}%`, background: 'linear-gradient(to top, #16a34a, #4ade80)' }} />
                <span className="text-xs text-slate-500">Wk {w}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3">Daily send limits per domain during warmup period (configurable via override)</p>
      </div>

      {/* Domain warmup cards */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(domains || []).map((d: any) => {
            const wp = d.warmupProgress
            return (
              <div key={d.id} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold text-slate-100">{d.domain}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{d.smtpHost}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.warmupEnabled ? (
                      <span className="badge-green flex items-center gap-1"><Thermometer size={10} /> Warming</span>
                    ) : (
                      <span className="badge-slate">Inactive</span>
                    )}
                    <button
                      onClick={() => toggleWarmup(d)}
                      className={d.warmupEnabled ? 'btn-secondary text-xs gap-1' : 'btn-primary text-xs gap-1'}
                      disabled={updateDomain.isPending}
                    >
                      {d.warmupEnabled ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Start</>}
                    </button>
                  </div>
                </div>

                {wp ? (
                  <>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">Week {wp.week} · {wp.dailyLimit.toLocaleString()} emails/day</span>
                      <span className="text-brand-400 font-semibold">{wp.progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-700" style={{ width: `${wp.progressPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                      <span>0</span>
                      <span>Target: {WARMUP_SCHEDULE[5].toLocaleString()}/day</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 bg-slate-800 rounded-lg p-3 text-center">
                    Warmup not started. Click "Start" to begin ramp-up.
                  </div>
                )}

                {/* Manual override */}
                {d.warmupEnabled && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <label className="label text-xs">Manual Override (emails/day, leave 0 for auto)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        defaultValue={d.dailyLimitOverride || 0}
                        className="input text-xs py-1.5"
                        onBlur={(e) => {
                          const v = parseInt(e.target.value)
                          updateDomain.mutate({ id: d.id, data: { dailyLimitOverride: v > 0 ? v : null } })
                        }}
                      />
                      <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 rounded-lg px-2">
                        <Zap size={11} className="text-yellow-400" /> Advanced
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
