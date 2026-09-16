import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trello, CheckCircle, Loader2, AlertCircle, Unlink, ArrowLeft } from 'lucide-react'
import { PageType } from '../App'
import {
  getTrelloStatus,
  startTrelloConnect,
  disconnectTrello,
  captureTrelloToken,
  type TrelloStatus,
} from '../services/trello'

/**
 * Trello connect / disconnect card.
 *
 * Strings are hardcoded in English rather than going through t(): this branch
 * is mid i18n migration and a missing key would render as the raw key. Move
 * them into the translation files once the Trello keys exist.
 */
interface TrelloConnectionProps {
  onNavigate?: (page: PageType) => void
}

export default function TrelloConnection({ onNavigate }: TrelloConnectionProps) {
  const [status, setStatus] = useState<TrelloStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        // Harmless if App already called it: with no token in the fragment
        // this returns null without touching anything.
        await captureTrelloToken()
      } catch (e: any) {
        setError(e?.message || 'Could not finish the Trello connection')
      }
      setStatus(await getTrelloStatus())
      setLoading(false)
    })()
  }, [])

  const handleConnect = async () => {
    setBusy(true); setError('')
    try {
      await startTrelloConnect()   // navigates away
    } catch (e: any) {
      setError(e?.message || 'Could not start the connection')
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true); setError('')
    try {
      await disconnectTrello()
      setStatus({ connected: false })
    } catch (e: any) {
      setError(e?.message || 'Could not disconnect')
    }
    setBusy(false)
  }

  const page = (inner: JSX.Element) => (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {onNavigate && (
          <button
            onClick={() => onNavigate('projects')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {inner}
      </div>
    </div>
  )

  if (loading) {
    return page(
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  return page(
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Trello className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-900">Trello</h3>
          {status.connected ? (
            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              Connected as <span className="font-medium">{status.username}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600 mt-1">
              Send your project tasks to a Trello board from the chat.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 break-words">{error}</p>
        </div>
      )}

      <div className="mt-6">
        {status.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trello className="w-4 h-4" />}
            Connect Trello
          </button>
        )}
      </div>

      {status.connected && (
        <p className="mt-4 text-xs text-slate-500">
          Try it in the chat: "what Trello boards do I have?"
        </p>
      )}
    </motion.div>
  )
}
