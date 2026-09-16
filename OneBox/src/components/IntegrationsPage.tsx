import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import ChannelsPanel from './ChannelsPanel'
import { PageType } from '../App'

interface IntegrationsPageProps {
  onNavigate: (page: PageType) => void
  gmailConnected: boolean
  onGmailRefresh?: () => void
  /** Username Trello just returned, when the user is landing from authorization. */
  trelloJustConnected?: string | null
}

/**
 * Integrations page.
 *
 * This is the "Settings / Integrations" view that ChannelsPanel.tsx was
 * always waiting for: the panel was written, then commented out of the
 * dashboard because it ate sidebar width without earning it. It was never
 * given another home, so the component sat unreachable in the codebase --
 * and so did the Trello connect button added to it.
 *
 * The panel itself is reused as-is, so Gmail, WhatsApp and Trello keep one
 * single source of truth for their connection state.
 */
export default function IntegrationsPage({
  onNavigate, gmailConnected, onGmailRefresh, trelloJustConnected,
}: IntegrationsPageProps) {
  const { t } = useTranslation()

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#0E0E1A]">
      <div className="max-w-xl mx-auto px-4 md:px-8 py-8">
        <h1 className="text-2xl font-bold text-white">
          {t('integrations.title', 'Integrations')}
        </h1>
        <p className="text-sm text-white/40 mt-1">
          {t('integrations.subtitle',
             'Connect the tools OneBox reads from and writes to. Click one to set it up.')}
        </p>

        {/* Coming back from an external authorization with no confirmation
            leaves the user guessing whether it worked. */}
        {trelloJustConnected && (
          <div className="mt-6 flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              {t('integrations.trelloConnected', 'Trello connected as')}{' '}
              <span className="font-semibold">@{trelloJustConnected}</span>
            </p>
          </div>
        )}

        <div className="mt-6">
          <ChannelsPanel
            onNavigate={onNavigate}
            gmailConnected={gmailConnected}
            onGmailRefresh={onGmailRefresh}
          />
        </div>

        <p className="text-xs text-white/30 mt-6 leading-relaxed">
          {t('integrations.hint',
             'Once Trello is connected you can say in the chat: "send the tasks of <project> to Trello".')}
        </p>
      </div>
    </div>
  )
}
