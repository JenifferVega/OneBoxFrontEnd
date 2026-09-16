// ============================================================================
// PlatformAdmin.tsx — Super admin panel (OneBox staff).
// ----------------------------------------------------------------------------
// Renders ONLY if /api/me returns isPlatformAdmin=true. The backend also
// guards every endpoint with require_capability(ADMINISTRAR_PLATAFORMA) —
// so even if someone forces the route here, the fetches respond 403.
//
// Visual structure:
//   ┌─ Global metrics (4 cards)
//   ├─ Status filters + search + "+ New organization" button
//   ├─ Grid of organization cards (click → drill-down)
//   └─ Modals:
//       - Create new org (concierge)
//       - Org detail (members + pending invitations + actions)
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import {
  Building2, Search, Plus, X, Users, Mail, Calendar,
  ShieldCheck, PauseCircle, Archive, PlayCircle, AlertCircle, Loader2, Trash2,
} from 'lucide-react'
import { api } from '../services/api'

type OrgStatus = 'active' | 'suspended' | 'archived'

interface OrgListItem {
  orgId: string
  name: string
  domain: string
  plan: string
  status: string
  createdAt: string
  propietarioEmail: string
  memberCount: number
}

interface OrgDetail {
  org: Record<string, any>
  members: Array<Record<string, any>>
  memberCount: number
  pendingInvitations: Array<Record<string, any>>
  pendingInvitationsCount: number
}

interface Metrics {
  orgsTotal: number
  orgsActive: number
  membersTotal: number
  pendingInvitationsTotal: number
}

// Only the visual classes live here. The label is resolved by each consumer
// with t('platform.status.<key>') to respect the current language.
const STATUS_CLASSES: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  suspended: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  archived:  'bg-white/5 text-white/40 border border-white/10',
}
function statusLabel(t: (k: string, d?: any) => string, status: string): string {
  return t(`platform.status.${status}`, status)
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

export default function PlatformAdmin() {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''

  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [orgs, setOrgs] = useState<OrgListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrgStatus>('all')
  const [search, setSearch] = useState('')

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null)

  const refresh = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [m, list] = await Promise.all([
        api.getPlatformMetrics(token),
        api.listPlatformOrgs(token, statusFilter === 'all' ? undefined : statusFilter),
      ])
      setMetrics(m)
      setOrgs(list.orgs)
    } catch (e: any) {
      setError(e?.message?.slice(0, 200) || t('platform.errors.loadData', 'Error loading data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, token])

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.domain.toLowerCase().includes(q) ||
      o.propietarioEmail.toLowerCase().includes(q) ||
      o.orgId.toLowerCase().includes(q)
    )
  }, [orgs, search])

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('platform.title', 'Organization management')}</h1>
          <p className="text-sm text-white/50">{t('platform.subtitle', 'Account, member and invitation management — OneBox staff only.')}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label={t('platform.metrics.orgsTotal', 'Total orgs')} value={metrics?.orgsTotal} loading={loading} />
        <MetricCard label={t('platform.metrics.orgsActive', 'Active orgs')} value={metrics?.orgsActive} loading={loading} accent="emerald" />
        <MetricCard label={t('platform.metrics.membersTotal', 'Total members')} value={metrics?.membersTotal} loading={loading} />
        <MetricCard label={t('platform.metrics.pendingInvitations', 'Pending invitations')} value={metrics?.pendingInvitationsTotal} loading={loading} accent="amber" />
      </div>

      {/* Toolbar: filter + search + create */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-[#161625] border border-white/5 rounded-xl p-1">
          {(['all', 'active', 'suspended', 'archived'] as const).map(s => {
            const isActive = statusFilter === s
            const labels: Record<string, string> = {
              all:       t('platform.filters.all', 'All'),
              active:    t('platform.filters.active', 'Active'),
              suspended: t('platform.filters.suspended', 'Suspended'),
              archived:  t('platform.filters.archived', 'Archived'),
            }
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {labels[s]}
              </button>
            )
          })}
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('platform.searchPlaceholder', 'Search by name, domain, owner email…')}
            className="w-full pl-10 pr-3 py-2.5 bg-[#161625] border border-white/5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/40"
          />
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t('platform.newOrg', 'New organization')}
        </button>
      </div>

      {/* Global state */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl mb-4">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Orgs grid */}
      {loading && orgs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('platform.loading', 'Loading organizations…')}
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-16 text-white/40 text-sm">
          {search
            ? t('platform.noSearchMatch', 'No organization matches the search.')
            : t('platform.noResults', 'No organizations yet with this filter.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrgs.map(o => (
            <OrgCard key={o.orgId} org={o} onClick={() => setDetailOrgId(o.orgId)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateOrgModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh() }}
        />
      )}
      {detailOrgId && (
        <OrgDetailPanel
          orgId={detailOrgId}
          token={token}
          onClose={() => setDetailOrgId(null)}
          onChanged={() => { refresh() }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label, value, loading, accent,
}: { label: string; value?: number; loading: boolean; accent?: 'emerald' | 'amber' }) {
  const valueClass =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'amber'   ? 'text-amber-400' :
    'text-white'
  return (
    <div className="bg-[#161625] border border-white/5 rounded-2xl px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">{label}</p>
      {loading && value === undefined ? (
        <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
      ) : (
        <p className={`text-3xl font-bold ${valueClass}`}>{value ?? 0}</p>
      )}
    </div>
  )
}

function OrgCard({ org, onClick }: { org: OrgListItem; onClick: () => void }) {
  const { t } = useTranslation()
  const statusKey = STATUS_CLASSES[org.status] ? org.status : 'archived'
  const badgeClasses = STATUS_CLASSES[statusKey]
  return (
    <button
      onClick={onClick}
      className="text-left bg-[#161625] border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-[#1a1a2b] transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-violet-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{org.name}</h3>
            <p className="text-xs text-white/40 truncate">{org.domain || org.orgId}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md whitespace-nowrap ${badgeClasses}`}>
          {statusLabel(t, statusKey)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{t('platform.memberCount', { count: org.memberCount, defaultValue: `${org.memberCount} members` })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="uppercase text-[10px] font-bold text-white/40">{t('platform.planLabel', 'plan')}</span>
          <span className="text-white/70">{org.plan}</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>{t('platform.createdOn', { date: formatDate(org.createdAt), defaultValue: `Created ${formatDate(org.createdAt)}` })}</span>
        </div>
        {org.propietarioEmail && (
          <div className="flex items-center gap-1.5 col-span-2 truncate">
            <Mail className="w-3.5 h-3.5" />
            <span className="truncate">{org.propietarioEmail}</span>
          </div>
        )}
      </div>
    </button>
  )
}

function CreateOrgModal({
  token, onClose, onCreated,
}: { token: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [plan, setPlan] = useState('trial')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')

  const canSubmit = name.trim().length >= 2 && email.includes('@')

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    setOkMessage('')
    try {
      const res = await api.createPlatformOrg({
        name: name.trim(),
        propietarioEmail: email.trim().toLowerCase(),
        domain: domain.trim().toLowerCase() || undefined,
        plan: plan.trim() || 'trial',
      }, token)
      setOkMessage(res.message || 'OK.')
      // Close smoothly after showing the message
      setTimeout(() => { onCreated() }, 900)
    } catch (e: any) {
      setError(e?.message?.slice(0, 200) || t('platform.errors.createOrg', 'Error creating organization'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title={t('platform.createOrg.title', 'New organization')} onClose={onClose}>
      <p
        className="text-xs text-white/50 mb-4"
        dangerouslySetInnerHTML={{
          __html: t(
            'platform.createOrg.helper',
            'The owner receives an email with a signup link. On signup, they are linked as <strong>owner</strong> of the new org.'
          ).replace('<strong>', '<strong class="text-white/80">')
        }}
      />

      <div className="space-y-3">
        <Field label={t('platform.createOrg.fieldName', 'Org name')} required>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('platform.createOrg.fieldNamePlaceholder', 'e.g., Acme Corp')}
            className="w-full px-3 py-2 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/40"
          />
        </Field>

        <Field label={t('platform.createOrg.fieldOwnerEmail', 'Owner email')} required>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('platform.createOrg.fieldOwnerEmailPlaceholder', 'owner@company.com')}
            type="email"
            className="w-full px-3 py-2 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/40"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('platform.createOrg.fieldDomain', 'Domain (optional)')}>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder={t('platform.createOrg.fieldDomainPlaceholder', 'company.com')}
              className="w-full px-3 py-2 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/40"
            />
          </Field>
          <Field label={t('platform.createOrg.fieldPlan', 'Plan')}>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full px-3 py-2 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white outline-none focus:border-violet-500/40"
            >
              <option value="trial">trial</option>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="enterprise">enterprise</option>
            </select>
          </Field>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {okMessage && (
          <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
            {okMessage}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-white/60 hover:text-white/90 transition-colors"
          disabled={submitting}
        >
          {t('platform.createOrg.cancel', 'Cancel')}
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('platform.createOrg.submit', 'Create and notify')}
        </button>
      </div>
    </ModalShell>
  )
}

function OrgDetailPanel({
  orgId, token, onClose, onChanged,
}: { orgId: string; token: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.getPlatformOrgDetail(orgId, token)
      setDetail(d)
    } catch (e: any) {
      setError(e?.message?.slice(0, 200) || t('platform.detail.errorLoad', 'Error loading details'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [orgId])

  const removeMember = async (userId: string, emailForConfirm: string) => {
    if (actionBusy || !userId) return
    const ok = window.confirm(
      t('platform.detail.confirm.removeMember', { email: emailForConfirm })
    )
    if (!ok) return
    setActionBusy(true)
    setActionMsg('')
    try {
      await api.removePlatformMember(orgId, userId, token)
      setActionMsg(t('platform.detail.msg.memberRemoved', { email: emailForConfirm }))
      await load()
      onChanged()
    } catch (e: any) {
      setActionMsg(t('platform.detail.msg.statusError', {
        error: e?.message?.slice(0, 200) || t('platform.detail.msg.memberRemoveErrorFallback', 'could not remove'),
      }))
    } finally {
      setActionBusy(false)
    }
  }

  const cancelInvitation = async (invitationId: string, emailForConfirm?: string) => {
    if (actionBusy || !invitationId) return
    const targetSuffix = emailForConfirm ? ` (${emailForConfirm})` : ''
    const ok = window.confirm(
      t('platform.detail.confirm.cancelInvitation', { target: targetSuffix })
    )
    if (!ok) return
    setActionBusy(true)
    setActionMsg('')
    try {
      await api.cancelPlatformInvitation(invitationId, token)
      setActionMsg(t('platform.detail.msg.invitationCancelled', 'Invitation cancelled.'))
      await load()
      onChanged()
    } catch (e: any) {
      setActionMsg(t('platform.detail.msg.statusError', {
        error: e?.message?.slice(0, 200) || t('platform.detail.msg.invitationCancelErrorFallback', 'could not cancel'),
      }))
    } finally {
      setActionBusy(false)
    }
  }

  const changeStatus = async (newStatus: OrgStatus) => {
    if (actionBusy) return
    const confirmKey =
      newStatus === 'suspended' ? 'platform.detail.confirm.suspend' :
      newStatus === 'archived'  ? 'platform.detail.confirm.archive' :
                                  'platform.detail.confirm.reactivate'
    const confirm = window.confirm(t(confirmKey))
    if (!confirm) return
    setActionBusy(true)
    setActionMsg('')
    try {
      const res = await api.updatePlatformOrgStatus(orgId, newStatus, token)
      setActionMsg(t('platform.detail.msg.statusChanged', { status: statusLabel(t, res.newStatus) }))
      await load()
      onChanged()
    } catch (e: any) {
      setActionMsg(t('platform.detail.msg.statusError', {
        error: e?.message?.slice(0, 150) || t('platform.detail.msg.statusErrorFallback', 'could not change status'),
      }))
    } finally {
      setActionBusy(false)
    }
  }

  const currentStatus: string = (detail?.org?.status as string) || 'active'
  const statusKey = STATUS_CLASSES[currentStatus] ? currentStatus : 'archived'
  const badgeClasses = STATUS_CLASSES[statusKey]

  return (
    <ModalShell title={t('platform.detail.title', 'Organization details')} onClose={onClose} wide>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('platform.detail.loading', 'Loading…')}
        </div>
      ) : error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
          {error}
        </div>
      ) : detail ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-violet-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{detail.org.name}</h2>
                <p className="text-xs text-white/50 truncate">
                  {t('platform.detail.subtitle', {
                    ref: detail.org.domain || detail.org.orgId,
                    plan: detail.org.plan || '—',
                    date: formatDate(detail.org.createdAt),
                  })}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md whitespace-nowrap ${badgeClasses}`}>
              {statusLabel(t, statusKey)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-y border-white/5 py-3">
            {currentStatus !== 'active' && (
              <ActionButton icon={PlayCircle} label={t('platform.detail.actions.reactivate', 'Reactivate')} onClick={() => changeStatus('active')} busy={actionBusy} color="emerald" />
            )}
            {currentStatus === 'active' && (
              <ActionButton icon={PauseCircle} label={t('platform.detail.actions.suspend', 'Suspend')} onClick={() => changeStatus('suspended')} busy={actionBusy} color="amber" />
            )}
            {currentStatus !== 'archived' && (
              <ActionButton icon={Archive} label={t('platform.detail.actions.archive', 'Archive')} onClick={() => changeStatus('archived')} busy={actionBusy} color="white" />
            )}
          </div>
          {actionMsg && (
            <div className="text-xs text-white/60 -mt-2">{actionMsg}</div>
          )}

          {/* Members */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />{' '}
              {t('platform.detail.membersHeader', { count: detail.memberCount })}
            </h3>
            {detail.members.length === 0 ? (
              <p className="text-xs text-white/40">{t('platform.detail.membersEmpty', 'No members registered yet.')}</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {detail.members.map((m, i) => (
                  <div key={m.userId || i} className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0E0E1A] rounded-lg border border-white/5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.email || m.userId}</p>
                      <p className="text-[11px] text-white/40">
                        {t('platform.detail.memberRoleLine', {
                          role: m.rolGlobal || '—',
                          date: formatDate(m.joinedAt || ''),
                        })}
                        {m.isPlatformAdmin && (
                          <span className="ml-2 text-violet-300 font-bold">
                            {t('platform.detail.superAdminBadge', 'super admin')}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      title={t('platform.detail.actions.removeMember', 'Remove member from org')}
                      disabled={actionBusy}
                      onClick={() => removeMember(m.userId, m.email || m.userId)}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending invitations */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />{' '}
              {t('platform.detail.invitationsHeader', { count: detail.pendingInvitationsCount })}
            </h3>
            {detail.pendingInvitations.length === 0 ? (
              <p className="text-xs text-white/40">{t('platform.detail.invitationsEmpty', 'No pending invitations.')}</p>
            ) : (
              <div className="space-y-1.5">
                {detail.pendingInvitations.map((inv, i) => {
                  const context = inv.projectName
                    ? t('platform.detail.invitationCtxProject', { name: inv.projectName })
                    : t('platform.detail.invitationCtxType', { type: inv.type || '—' })
                  return (
                    <div key={inv.invitationId || i} className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0E0E1A] rounded-lg border border-white/5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{inv.email}</p>
                        <p className="text-[11px] text-white/40">
                          {t('platform.detail.invitationLine', {
                            context,
                            role: inv.rolGlobal || inv.role || '—',
                            date: formatDate(inv.createdAt || ''),
                          })}
                        </p>
                      </div>
                      <button
                        title={t('platform.detail.actions.cancelInvitation', 'Cancel invitation')}
                        disabled={actionBusy}
                        onClick={() => cancelInvitation(inv.invitationId, inv.email)}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// UI primitives
// ────────────────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

function ActionButton({
  icon: Icon, label, onClick, busy, color,
}: { icon: any; label: string; onClick: () => void; busy: boolean; color: 'emerald' | 'amber' | 'white' }) {
  const classes =
    color === 'emerald' ? 'text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10' :
    color === 'amber'   ? 'text-amber-400 border-amber-500/25 hover:bg-amber-500/10' :
                          'text-white/70 border-white/10 hover:bg-white/5'
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${classes}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function ModalShell({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-[#12121E] border border-white/10 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[85vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
