import { motion } from 'framer-motion'
import { 
  MessageSquare, 
  Send, 
  Mail, 
  Hash, 
  ArrowRight, 
  Check,
  Zap,
  Users,
  FolderKanban,
  Play,
  Sparkles
} from 'lucide-react'

interface LandingPageProps {
  onGetStarted: () => void
  onLogin?: () => void
}

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const handleLogin = onLogin || onGetStarted
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">OneBox</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Características</a>
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Cómo funciona</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Precios</a>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogin}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Iniciar sesión
            </button>
            <button 
              onClick={onGetStarted}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              Comenzar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Full viewport height */}
      <section className="min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-8"
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Ahora en beta pública
            </motion.div>

            {/* Floating Icons - Dispersed around the content like reference */}
            <div className="relative">
              {/* Top Left - Message icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute -left-48 -top-4 hidden xl:block"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50">
                  <MessageSquare className="w-8 h-8 text-emerald-500" />
                </div>
              </motion.div>
              
              {/* Top Right - Send/Telegram icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -right-48 -top-4 hidden xl:block"
              >
                <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200/50">
                  <Send className="w-7 h-7 text-violet-500" />
                </div>
              </motion.div>

              {/* Bottom Left - Hash/Slack icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="absolute -left-40 top-32 hidden xl:block"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
                  <Hash className="w-6 h-6 text-indigo-500" />
                </div>
              </motion.div>

              {/* Bottom Right - Email icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="absolute -right-40 top-32 hidden xl:block"
              >
                <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200/50">
                  <Mail className="w-7 h-7 text-rose-400" />
                </div>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-tight"
              >
                Todas tus conversaciones
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
                  en un solo lugar
                </span>
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-10 text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
            >
              OneBox elimina la fricción entre canales. Unifica WhatsApp, Slack, Email
              y más en un inbox inteligente que todo tu equipo puede usar.
              <br />
              <strong className="text-slate-800">Y ejecuta acciones reales en tus proyectos.</strong>
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button 
                onClick={onGetStarted}
                className="px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 flex items-center gap-2 group"
              >
                Comenzar gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-2">
                <Play className="w-5 h-5" />
                Ver demo
              </button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-500 flex-wrap"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                14 días de prueba gratis
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Sin tarjeta de crédito
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Configura en minutos
              </div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-16 flex flex-col items-center gap-2"
            >
              <span className="text-xs text-slate-400">Descubre más</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-6 h-10 border-2 border-slate-300 rounded-full flex items-start justify-center p-2"
              >
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-32 px-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Cómo funciona</h2>
            <p className="mt-4 text-lg text-slate-600">De canales fragmentados a claridad unificada en tres simples pasos</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <FolderKanban className="w-7 h-7 text-blue-600" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-slate-400 font-medium">01</span>
                <div className="flex-1 h-px bg-slate-200" />
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Crea un proyecto</h3>
              <p className="text-slate-600">
                Define tu proyecto, agrega participantes y conecta los canales que usas.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative"
            >
              <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-violet-600" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-slate-400 font-medium">02</span>
                <div className="flex-1 h-px bg-slate-200" />
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">La IA detecta acciones</h3>
              <p className="text-slate-600">
                Nuestra IA entiende órdenes, bloqueos y decisiones de tus conversaciones.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-purple-600" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-slate-400 font-medium">03</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Ejecución real</h3>
              <p className="text-slate-600">
                Se crean tareas, se notifica al equipo, se marcan bloqueos — automáticamente.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Differentiation */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-sm font-medium text-violet-600 uppercase tracking-wider">Por qué OneBox</span>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900">
                No somos otro inbox.
                <br />
                <span className="text-violet-600">Somos ejecución.</span>
              </h2>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                Las decisiones viven en conversaciones. Pero la ejecución no sucede ahí.
                OneBox es la capa que conecta lo que dices con lo que se hace.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Los inboxes muestran mensajes</h4>
                    <p className="text-slate-600">Organizan, muestran. Eso es todo.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Las herramientas de automatización ejecutan reglas</h4>
                    <p className="text-slate-600">Si X entonces Y. Rígidas, frágiles, limitadas.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">OneBox ejecuta decisiones</h4>
                    <p className="text-slate-600">Entendemos contexto, detectamos intención, y actuamos en tus proyectos.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Preview */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
              <p className="text-sm font-medium text-slate-500 mb-6">Lo que OneBox hace por ti:</p>
              
              <div className="space-y-4">
                {[
                  { action: 'Tarea creada', detail: '"Revisar propuesta de cliente"', status: 'done', color: 'emerald' },
                  { action: 'Equipo notificado', detail: 'Slack #proyecto-alpha', status: 'done', color: 'emerald' },
                  { action: 'Bloqueo detectado', detail: 'Esperando aprobación de diseño', status: 'pending', color: 'amber' },
                  { action: 'Seguimiento programado', detail: 'En 3 días con Santiago', status: 'done', color: 'emerald' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.status === 'done' ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      <Check className={`w-4 h-4 ${
                        item.status === 'done' ? 'text-emerald-600' : 'text-amber-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.action}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      item.status === 'done' 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {item.status === 'done' ? 'Hecho' : 'Pendiente'}
                    </span>
                  </motion.div>
                ))}
              </div>

              <p className="mt-6 text-center text-sm text-slate-500">
                "Mira todo lo que OneBox ya hizo por ti"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            De conversaciones dispersas a
            <br />
            <span className="text-violet-400">proyectos bajo control</span>
          </h2>
          <p className="mt-6 text-lg text-slate-400">
            Las empresas hablan en WhatsApp. Pero trabajan en Asana, CRMs y ERPs.
            <br />
            OneBox conecta ambos mundos.
          </p>
          <button 
            onClick={onGetStarted}
            className="mt-10 px-8 py-4 bg-white text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-all shadow-lg flex items-center gap-2 mx-auto group"
          >
            Empezar gratis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-800">OneBox</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 OneBox. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}