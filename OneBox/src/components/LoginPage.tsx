import { motion } from 'framer-motion'
import { Mail, Loader2, Inbox, Network, Sparkles, BarChart3 } from 'lucide-react'
import { useAuth } from 'react-oidc-context'

export default function LoginPage() {
  const auth = useAuth()

  function handleGoogleLogin() {
    auth.signinRedirect({
      extraQueryParams: {
        identity_provider: 'Google'
      }
    })
  }

  function handleLogin() {
    auth.signinRedirect()
  }

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Conectando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="#06b6d4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 2 }}
          className="absolute top-1/4 left-1/4 w-96 h-96"
        >
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <motion.line
              x1="0" y1="200" x2="400" y2="100"
              stroke="#06b6d4"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
            />
            <motion.line
              x1="100" y1="0" x2="300" y2="400"
              stroke="#8b5cf6"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", delay: 0.5 }}
            />
            <motion.line
              x1="50" y1="350" x2="350" y2="50"
              stroke="#06b6d4"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 3.5, repeat: Infinity, repeatType: "reverse", delay: 1 }}
            />
          </svg>
        </motion.div>
      </div>

      <div className="hidden lg:flex lg:w-auto p-12 pr-16 flex-col justify-between relative z-10">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Inbox className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">OneBox</span>
          </motion.div>
        </div>

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold text-white mb-6 leading-tight max-w-2xl"
          >
            Transforma tu informacion en{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              proyectos al instante 
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 text-lg leading-relaxed max-w-2xl"
          >
            Conecta tu informacion y deja que nuestro sistema te ayude a organizar tus proyectos. Visualiza todo en un dashboard inteligente.
          </motion.p>

          <div className="max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-10 space-y-4"
            >
              {[
                { icon: Sparkles, text: 'Análisis automático de contenido.', color: 'text-violet-400' },
                { icon: BarChart3, text: 'Dashboard con métricas en tiempo real.', color: 'text-emerald-400' }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
                >
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  <span className="text-slate-300">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-12 flex gap-8"
            >
              {[
                { value: '10K+', label: 'Correos/día' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-slate-600 text-sm"
        >
          © 2026 OneBox. Plataforma Inteligente de Análisis.
        </motion.p>
      </div>

      <div className="w-full lg:w-auto flex items-center justify-center p-8 lg:pl-16 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-xl flex items-center justify-center">
              <Inbox className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">OneBox</span>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.3 }}
                className="w-16 h-16 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20"
              >
                <Mail className="w-8 h-8 text-cyan-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white">
                Bienvenido a OneBox
              </h2>
              <p className="text-slate-400 mt-2">
                Inicia sesión o Registrate para empezar!
              </p>
            </div>

            {auth.error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <p className="text-sm text-red-400">{auth.error.message}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleLogin}
                className="w-full py-4 px-4 bg-white hover:bg-slate-50 rounded-xl font-semibold text-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </motion.button>

              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-900 text-slate-500">o</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/25"
              >
                Iniciar sesión con Email
              </motion.button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-center text-xs text-slate-500">
                Al continuar, aceptas nuestros{' '}
                <a href="#" className="text-cyan-400 hover:underline">términos de servicio</a>
                {' '}y{' '}
                <a href="#" className="text-cyan-400 hover:underline">política de privacidad</a>.
              </p>
              <p className="text-center text-xs text-slate-600 mt-3">
                🔒 Conexión segura con permisos de solo lectura
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
