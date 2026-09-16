import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Mail, Loader2, Lock, User as UserIcon, ArrowLeft, KeyRound } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import Logo from './Logo'
import LocaleSwitcher from './LocaleSwitcher'
import {
  signUp, confirmSignUp, resendCode, signIn,
  forgotPassword, confirmForgotPassword, friendlyError,
  completeNewPassword, NewPasswordRequiredError,
} from '../services/cognitoAuth'

type Mode = 'login' | 'register' | 'confirm' | 'forgot' | 'reset' | 'newPassword'

export default function LoginPage() {
  const auth = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function handleGoogleLogin() {
    auth.signinRedirect({ extraQueryParams: { identity_provider: 'Google' } })
  }

  // Microsoft SSO. The 'Microsoft' name must match EXACTLY the ProviderName
  // configured in Cognito (us-east-1_b76prubhx → OIDC IdP).
  function handleMicrosoftLogin() {
    auth.signinRedirect({ extraQueryParams: { identity_provider: 'Microsoft' } })
  }

  function reset(toMode: Mode) {
    setError(''); setInfo(''); setCode(''); setMode(toMode)
  }

  async function doLogin() {
    setLoading(true); setError(''); setInfo('')
    try {
      await signIn(email.trim(), password)
      // react-oidc-context reads the session from storage on init → reload.
      window.location.href = '/'
    } catch (e: any) {
      // Special case: invited account with a temporary password — must set their own.
      if (e instanceof NewPasswordRequiredError || e?.name === 'NewPasswordRequiredError') {
        reset('newPassword')
        setPassword('')
        setInfo(t('login.info.tempPassword'))
        return
      }
      // If not confirmed, take them to the code step.
      if ((e?.code || e?.name) === 'UserNotConfirmedException') {
        setInfo(t('login.info.notConfirmed'))
        try { await resendCode(email.trim()) } catch {}
        reset('confirm')
      } else {
        setError(friendlyError(e))
      }
    } finally {
      setLoading(false)
    }
  }

  async function doNewPassword() {
    setLoading(true); setError(''); setInfo('')
    try {
      await completeNewPassword(password)
      window.location.href = '/'
    } catch (e: any) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  async function doRegister() {
    setLoading(true); setError(''); setInfo('')
    try {
      await signUp(email.trim(), password, name.trim() || undefined)
      setInfo(t('login.info.codeSent'))
      reset('confirm')
      setInfo(t('login.info.codeSent'))
    } catch (e: any) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  async function doConfirm() {
    setLoading(true); setError(''); setInfo('')
    try {
      await confirmSignUp(email.trim(), code.trim())
      // Auto-login after confirming (use the password we already have).
      await signIn(email.trim(), password)
      window.location.href = '/'
    } catch (e: any) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  async function doForgot() {
    setLoading(true); setError(''); setInfo('')
    try {
      await forgotPassword(email.trim())
      setInfo(t('login.info.forgotSent'))
      reset('reset')
      setInfo(t('login.info.forgotSent'))
    } catch (e: any) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  async function doReset() {
    setLoading(true); setError(''); setInfo('')
    try {
      await confirmForgotPassword(email.trim(), code.trim(), password)
      setInfo(t('login.info.passwordReset'))
      reset('login')
      setInfo(t('login.info.passwordReset'))
    } catch (e: any) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, { h: string; p: string }> = {
    login:       { h: t('login.titles.loginH'),       p: t('login.titles.loginP') },
    register:    { h: t('login.titles.registerH'),    p: t('login.titles.registerP') },
    confirm:     { h: t('login.titles.confirmH'),     p: email ? t('login.titles.confirmP', { email }) : t('login.titles.confirmPFallback') },
    forgot:      { h: t('login.titles.forgotH'),      p: t('login.titles.forgotP') },
    reset:       { h: t('login.titles.resetH'),       p: t('login.titles.resetP') },
    newPassword: { h: t('login.titles.newPasswordH'), p: t('login.titles.newPasswordP') },
  }

  const inputCls =
    'w-full pl-10 pr-3 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition'

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      {/* Language switcher pinned to the top right of the login. */}
      <div className="absolute top-4 right-4 z-10">
        <LocaleSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="lg" />
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8">
          <div className="text-center mb-6">
            {mode !== 'login' && mode !== 'register' && (
              <button
                onClick={() => reset(mode === 'confirm' ? 'register' : 'login')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t('common.back')}
              </button>
            )}
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-cyan-500/20">
              <Mail className="w-7 h-7 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">{titles[mode].h}</h2>
            <p className="text-slate-400 mt-1 text-sm">{titles[mode].p}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          {info && !error && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-emerald-400">{info}</p>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (loading) return
              if (mode === 'login') doLogin()
              else if (mode === 'register') doRegister()
              else if (mode === 'confirm') doConfirm()
              else if (mode === 'forgot') doForgot()
              else if (mode === 'reset') doReset()
              else if (mode === 'newPassword') doNewPassword()
            }}
            className="space-y-3"
          >
            {mode === 'register' && (
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={inputCls} placeholder={t('login.field.name')} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={inputCls} type="email" placeholder={t('login.field.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            )}

            {(mode === 'confirm' || mode === 'reset') && (
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={inputCls} placeholder={t('login.field.code')} value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset' || mode === 'newPassword') && (
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={inputCls} type="password" placeholder={mode === 'reset' || mode === 'newPassword' ? t('login.field.newPassword') : t('login.field.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}

            {(mode === 'register' || mode === 'reset' || mode === 'newPassword') && (
              <p className="text-[11px] text-slate-500 px-1">{t('login.passwordHint')}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' && t('login.submit.login')}
              {mode === 'register' && t('login.submit.register')}
              {mode === 'confirm' && t('login.submit.confirm')}
              {mode === 'forgot' && t('login.submit.forgot')}
              {mode === 'reset' && t('login.submit.reset')}
              {mode === 'newPassword' && t('login.submit.newPassword')}
            </button>
          </form>

          {mode === 'confirm' && (
            <button onClick={() => resendCode(email.trim()).then(() => setInfo(t('login.info.codeResent'))).catch((e) => setError(friendlyError(e)))} className="w-full mt-3 text-xs text-cyan-400 hover:underline">
              {t('login.resendCode')}
            </button>
          )}

          {mode === 'login' && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <button onClick={() => reset('forgot')} className="text-slate-400 hover:text-white">{t('login.forgotLink')}</button>
              <button onClick={() => reset('register')} className="text-cyan-400 hover:underline">{t('login.registerLink')}</button>
            </div>
          )}
          {mode === 'register' && (
            <p className="mt-3 text-center text-xs text-slate-400">
              {t('login.haveAccount')}{' '}
              <button onClick={() => reset('login')} className="text-cyan-400 hover:underline">{t('login.loginLink')}</button>
            </p>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
                <div className="relative flex justify-center text-sm"><span className="px-4 bg-slate-900 text-slate-500">{t('common.or')}</span></div>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 rounded-xl font-semibold text-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('login.continueGoogle')}
              </button>
              {/* Microsoft SSO (Entra ID + personal accounts).
                  The 'Microsoft' IdP is configured in the User Pool as OIDC
                  pointing at login.microsoftonline.com/common. The Pre-SignUp
                  Lambda automatically links if the same email already exists
                  via Google or native. */}
              <button
                onClick={handleMicrosoftLogin}
                className="w-full mt-3 py-3 px-4 bg-white hover:bg-slate-50 rounded-xl font-semibold text-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
                {t('login.continueMicrosoft')}
              </button>
            </>
          )}
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">{t('login.footerCopyright')}</p>
      </motion.div>
    </div>
  )
}
