import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from 'react-oidc-context'
import Layout from './components/Layout'
import Projects from './components/Projects'
import Intelligence from './components/Intelligence'
import ProjectWizard, { InitialDocumentDraft } from './components/ProjectWizard'
import ConnectGmail from './components/GmailConection'
import LandingPage from './components/Landingpage'
import OnboardingForm, { PendingProject } from './components/OnboardingForm'
import LoginPage from './components/LoginPage'
import FloatChat from './components/FloatChat'
import NotificationsPage from './components/NotificationsPage'
import TrelloConnection from './components/TrelloConnection'
import IntegrationsPage from './components/IntegrationsPage'
import SettingsPage, { browserTimezone } from './components/SettingsPage'
import { setAppLocale, getAppLocale } from './i18n'
import { captureTrelloToken } from './services/trello'
import PlatformAdmin from './components/PlatformAdmin'
import { setUserId, setUserEmail, getUserId, getUserEmail, clearUserSession, api } from './services/api'

const PENDING_PROJECT_KEY = 'onebox_pending_project'

export type PageType = 'projects' | 'intelligence' | 'platform' | 'orders-center' | 'wizard' | 'connect-gmail' | 'connect-trello' | 'integrations' | 'notifications' | 'settings'

// ── Internal navigation and the browser Back button ─────────────────────────
// The current page used to live only in React state, so navigating created no
// history entries at all: Back left the app (or, coming back from an external
// auth redirect, reloaded it at the default page). Mirroring the page in the
// URL makes Back mean what the user expects.
//
// A query param, not a hash: Trello hands its token back in the fragment
// (#token=...), so a hash-based route would collide with it.
const PAGES: PageType[] = ['projects', 'intelligence', 'platform', 'orders-center',
  'wizard', 'connect-gmail', 'connect-trello', 'integrations', 'notifications', 'settings']
const DEFAULT_PAGE: PageType = 'projects'

function pageFromUrl(): PageType {
  const raw = new URLSearchParams(window.location.search).get('page')
  return PAGES.includes(raw as PageType) ? (raw as PageType) : DEFAULT_PAGE
}

/** Same URL, with ?page= set and any one-shot auth params stripped. */
function urlForPage(page: PageType): string {
  const params = new URLSearchParams(window.location.search)
  for (const junk of ['code', 'state', 'gmail', 'error', 'token']) params.delete(junk)
  // An open project belongs to the Projects page; changing page closes it.
  params.delete('project')
  // Intelligence's tab and planning project belong to that page too.
  params.delete('tab')
  params.delete('planProject')
  if (page === DEFAULT_PAGE) params.delete('page')
  else params.set('page', page)
  const qs = params.toString()
  return window.location.pathname + (qs ? `?${qs}` : '')
}

export default function App() {
  const auth = useAuth()
  const [currentPage, setCurrentPage] = useState<PageType>(pageFromUrl)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [checkingGmail, setCheckingGmail] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [creatingPending, setCreatingPending] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<InitialDocumentDraft | null>(null)

  const [projectsResetSignal, setProjectsResetSignal] = useState(0)
  // Flag to render the "Platform" tab. Populated via /api/me on
  // authentication. Default false → the tab is not shown. If the fetch fails,
  // it stays false; the backend also protects /api/platform/* with 403.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  // THE single entry point for changing page. Everything navigates through
  // here -- children included -- or the history entry is not created and Back
  // silently skips that step.
  //
  // pushState must NOT run inside a setState updater: React StrictMode runs
  // updaters twice in development, which pushed every page twice and made
  // Back look like it did nothing. A ref holds the page actually shown.
  const pageRef = useRef<PageType>(currentPage)
  useEffect(() => { pageRef.current = currentPage }, [currentPage])
  const navigate = useCallback((page: PageType) => {
    if (page !== pageRef.current) {
      window.history.pushState({ page }, '', urlForPage(page))
      pageRef.current = page
    }
    setCurrentPage(page)
  }, [])

  const handleNavigate = (page: PageType) => {
    if (page === currentPage && page === 'projects') {
      setProjectsResetSignal(prev => prev + 1)
    } else {
      navigate(page)
    }
  }

  // Back / Forward: the browser changed the URL, so we follow it. No
  // pushState here -- the entry already exists, adding another would trap the
  // user in a loop where Back never leaves the page.
  useEffect(() => {
    const onPop = () => {
      const page = pageFromUrl()
      pageRef.current = page
      setCurrentPage(page)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Trello hands its token back in the URL FRAGMENT (#token=...), and the
  // fragment never reaches the server -- only the browser sees it. It also
  // lands on whatever page the return URL resolves to, which is the default
  // one, NOT the Trello screen. So capturing it inside TrelloConnection was
  // useless: that component is not mounted when the redirect arrives, and the
  // token was silently dropped on the next navigation.
  //
  // It has to be captured here, at startup, before anything else rewrites the
  // URL. captureTrelloToken() is a no-op when there is no token in the hash.
  const [trelloJustConnected, setTrelloJustConnected] = useState<string | null>(null)
  useEffect(() => {
    if (!auth.isAuthenticated) return
    captureTrelloToken()
      .then(username => {
        if (!username) return
        setTrelloJustConnected(username)
        navigate('integrations')
      })
      .catch(err => console.error('[Trello] could not save the token:', err))
  }, [auth.isAuthenticated, navigate])

  const isPreview = window.location.search.includes('preview=true')

 
  if (auth.isAuthenticated && auth.user?.profile?.sub) {
    const newUserId = auth.user.profile.sub
    const storedUserId = getUserId()
    const newUserEmail = ((auth.user.profile.email as string) || '').toLowerCase()
    const storedUserEmail = getUserEmail().toLowerCase()
    if (storedUserId !== newUserId) {
      if (storedUserId) {
        console.warn('[App] User change detected, clearing previous session')
        clearUserSession()
      }
      setUserId(newUserId)
      if (newUserEmail) setUserEmail(newUserEmail)
      const newUserName = (auth.user.profile.name as string) || ''
      if (newUserName) {
        try { localStorage.setItem('onebox_user_name', newUserName) } catch { /* private mode */ }
      }
    } else if (newUserEmail && newUserEmail !== storedUserEmail) {
      // Same user id, but the email in localStorage does not match the profile's.
      // Can happen when: old sessions where the email failed to save, or the
      // user updated their email in Cognito. Without this resync, `x-user-email` is sent
      // empty to the backend and the invitation auto-accept never fires → the invitee does
      // not see their linked projects. We update WITHOUT clearing the session (same user).
      console.info('[App] Re-syncing profile email to localStorage')
      setUserEmail(newUserEmail)
    }
  }

  useEffect(() => {
    const handlePendingProject = async () => {
      console.log('[pending project] Auth check:', { isAuthenticated: auth.isAuthenticated, userId: auth.user?.profile?.sub })
      if (!auth.isAuthenticated || !auth.user?.profile?.sub) return
      const raw = localStorage.getItem(PENDING_PROJECT_KEY)
      console.log('[pending project] Found in localStorage:', !!raw)
      if (!raw) return
      try {
        const pending: PendingProject = JSON.parse(raw)
        console.log('[pending project] Parsed pending project:', pending)
        const token = auth.user.access_token || ''
        const userId = auth.user.profile.sub
        console.log('[pending project] Token available:', !!token)

        setCreatingPending(true)

        if (pending.documentBase64 && pending.documentName) {
          console.log('[pending project] Processing document for review:', pending.documentName)
          try {
            const binaryStr = atob(pending.documentBase64)
            const bytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
            const blob = new Blob([bytes], { type: pending.documentContentType || 'application/octet-stream' })
            const file = new File([blob], pending.documentName, { type: pending.documentContentType || 'application/octet-stream' })

            api.analyzeDocumentPreview(file, { userId, token })
              .then((res) => {
                console.log('[pending project] Document analyzed, draft:', res?.draftId)
                localStorage.removeItem(PENDING_PROJECT_KEY)
                setPendingDraft({
                  draftId: res.draftId,
                  fileName: res.fileName,
                  fileSize: res.fileSize,
                  extractedTextLength: res.extractedTextLength,
                  suggestion: res.suggestion,
                })
                navigate('wizard')
              })
              .catch(err => {
                console.error('[pending project] Error analyzing document:', err)
                localStorage.removeItem(PENDING_PROJECT_KEY)
                navigate('projects')
              })
              .finally(() => {
                setCreatingPending(false)
              })
          } catch (decodeErr) {
            console.error('[pending project] Error decoding document:', decodeErr)
            localStorage.removeItem(PENDING_PROJECT_KEY)
            setCreatingPending(false)
          }
          return
        }

        if (pending.pastedText && pending.pastedText.trim().length >= 50) {
          console.log('[pending project] Processing pasted text for review:', pending.pastedText.length, 'chars')
          api.analyzeTextPreview(
            { text: pending.pastedText, source: pending.pastedSource || 'paste' },
            token
          )
            .then((res) => {
              console.log('[pending project] Text analyzed, draft:', res?.draftId)
              localStorage.removeItem(PENDING_PROJECT_KEY)
              setPendingDraft({
                draftId: res.draftId,
                fileName: res.fileName,
                fileSize: res.fileSize,
                extractedTextLength: res.extractedTextLength,
                suggestion: res.suggestion,
              })
              navigate('wizard')
            })
            .catch(err => {
              console.error('[pending project] Error analyzing text:', err)
              localStorage.removeItem(PENDING_PROJECT_KEY)
              navigate('projects')
            })
            .finally(() => {
              setCreatingPending(false)
            })
          return
        }

        const whatsappParticipants = (pending.whatsappNumbers || []).map(phoneNumber => ({
          name: phoneNumber,
          email: '',
          phone: phoneNumber,
          role: 'WhatsApp Contact'
        }))
        const emailParticipants = (pending.emails || []).map(email => ({
          name: email.split('@')[0],
          email: email,
          phone: '',
          role: 'Email Contact'
        }))
        const participants = [...emailParticipants, ...whatsappParticipants]

        api.createProject({
          name: pending.name,
          description: pending.description,
          type: pending.type,
          channels: pending.channels,
          participants: participants,
        }, token)
          .then(() => console.log('[pending project] Project created successfully'))
          .catch(err => console.error('[pending project] error creating project:', err))
          .finally(() => {
            console.log('[pending project] Cleanup: removing from localStorage and navigating')
            localStorage.removeItem(PENDING_PROJECT_KEY)
            setCreatingPending(false)
            navigate('projects')
          })
      } catch (e) {
        console.error('[pending project] invalid payload:', e)
        localStorage.removeItem(PENDING_PROJECT_KEY)
      }
    }

    handlePendingProject()
  }, [auth.isAuthenticated, auth.user?.profile?.sub])

  const handleOnboardingSubmit = (data: PendingProject) => {
    localStorage.setItem(PENDING_PROJECT_KEY, JSON.stringify(data))
    auth.signinRedirect()
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.profile?.sub) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      fetch(`${API_URL}/api/gmail/status`, {
        headers: { 'x-user-id': auth.user.profile.sub }
      })
        .then(res => res.json())
        .then(data => {

          setGmailConnected(!!data.connected)
          setCheckingGmail(false)
        })
        .catch(() => setCheckingGmail(false))
    } else {
      setCheckingGmail(false)
    }
  }, [auth.isAuthenticated, auth.user?.profile?.sub])

  useEffect(() => {
    if (auth.isAuthenticated && window.location.search && !isPreview) {
      if (window.location.search.includes('gmail=connected')) {
        setGmailConnected(true)
        // Land on Integrations, where the user started the connection, instead
        // of dumping them on the dashboard.
        setCurrentPage('integrations')
        window.history.replaceState({ page: 'integrations' }, '', urlForPage('integrations'))
        return
      }
      // Strip the one-shot auth params but KEEP ?page: this used to reset the
      // URL to '/', which threw away the page the user was on.
      window.history.replaceState({ page: pageFromUrl() }, '', urlForPage(pageFromUrl()))
    }
  }, [auth.isAuthenticated, isPreview])

  // Load the user context (/api/me) to decide whether to show the Platform
  // tab. We do NOT block rendering if it fails — the tab simply does not
  // appear. The backend also guards every /api/platform/* endpoint with 403.
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.access_token) return
    let cancelled = false
    api.getMe(auth.user.access_token)
      .then(me => {
        if (cancelled) return
        setIsPlatformAdmin(!!me.isPlatformAdmin)
      })
      .catch(() => { /* silent: tab does not appear */ })
    return () => { cancelled = true }
  }, [auth.isAuthenticated, auth.user?.access_token])

  // The user's saved preferences. The language saved in the backend wins over
  // this browser's localStorage, so it follows the user to other devices.
  // The timezone is filled in from the browser the first time: the agent
  // needs one for WhatsApp turns and scheduled sends, and asking every user to
  // open Settings first would leave most of them on the server's default.
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.access_token) return
    const token = auth.user.access_token
    let cancelled = false
    api.getUserSettings(token)
      .then(s => {
        if (cancelled) return
        if (s.language && s.language !== getAppLocale()) setAppLocale(s.language)
        const missing: { timezone?: string; language?: 'es' | 'en' } = {}
        const tz = browserTimezone()
        if (!s.timezone && tz) missing.timezone = tz
        if (!s.language) missing.language = getAppLocale()
        if (Object.keys(missing).length) {
          api.updateUserSettings(missing, token).catch(() => { /* retried next login */ })
        }
      })
      .catch(() => { /* settings unavailable: defaults apply */ })
    return () => { cancelled = true }
  }, [auth.isAuthenticated, auth.user?.access_token])

  if (!isPreview) {
    if (auth.isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0B14]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/50">Connecting...</p>
          </div>
        </div>
      )
    }

    if (auth.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0B14]">
          <div className="text-center p-8 bg-[#12121E] rounded-2xl border border-white/10 max-w-md">
            <p className="text-red-400 mb-4">Error: {auth.error.message}</p>
            <button
              onClick={() => auth.signinRedirect()}
              className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    if (!auth.isAuthenticated) {
      if (showLogin) {
        return <LoginPage />
      }
      if (showOnboarding) {
        return (
          <OnboardingForm
            onBack={() => setShowOnboarding(false)}
            onSubmit={handleOnboardingSubmit}
            onLoginInstead={() => setShowLogin(true)}
          />
        )
      }
      return (
        <LandingPage
          onGetStarted={() => setShowOnboarding(true)}
          onLogin={() => setShowLogin(true)}
        />
      )
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'projects':
        return <Projects onNavigate={navigate} gmailConnected={gmailConnected} resetSignal={projectsResetSignal} />
      case 'intelligence':
        return <Intelligence />
      case 'platform':
        // Double guard: only renders if the flag is active. If someone
        // navigates manually without being a super admin, we fall back to the default project view.
        return isPlatformAdmin ? <PlatformAdmin /> : <Projects onNavigate={navigate} gmailConnected={gmailConnected} resetSignal={projectsResetSignal} />
      case 'wizard':
        return (
          <ProjectWizard
            onNavigate={navigate}
            initialDraft={pendingDraft}
            onWizardClose={() => setPendingDraft(null)}
          />
        )
      case 'connect-gmail':
        return <ConnectGmail onNavigate={navigate} onConnected={() => setGmailConnected(true)} gmailConnected={gmailConnected} />
      case 'integrations':
        return (
          <IntegrationsPage
            onNavigate={navigate}
            gmailConnected={gmailConnected}
            onGmailRefresh={() => setGmailConnected(true)}
            trelloJustConnected={trelloJustConnected}
          />
        )
      case 'connect-trello':
        return <TrelloConnection onNavigate={navigate} />
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} />
      case 'settings':
        return <SettingsPage />
      case 'orders-center':
        return (
          <div className="flex items-center justify-center h-[calc(100vh-56px)]">
            <div className="text-center">
              <div className="text-4xl mb-4">🚧</div>
              <h2 className="text-xl font-bold text-white">Order Center</h2>
              <p className="text-white/50 mt-2">Coming soon</p>
            </div>
          </div>
        )
      default:
        return <Projects onNavigate={navigate} gmailConnected={gmailConnected} resetSignal={projectsResetSignal} />
    }
  }

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onNewProject={() => navigate('wizard')} isPlatformAdmin={isPlatformAdmin}>
        {renderPage()}
      </Layout>
      <FloatChat />
    </>
  )
}
