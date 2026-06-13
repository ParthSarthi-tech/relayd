import { Link, useRouter } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Shield, Sparkles, User, Zap } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth'

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
}

const features = [
  { icon: Shield, text: 'HMAC-SHA256 signature verification' },
  { icon: Zap, text: 'Automatic retries with exponential backoff' },
  { icon: Sparkles, text: 'Real-time monitoring & dead-letter queues' },
]

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError('Please fill in all fields')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      await register({ email: email.trim(), password, name: name.trim() })
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — brand showcase */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-12 lg:flex">
        {/* Animated gradient orbs */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-40 -right-20 h-[600px] w-[600px] rounded-full bg-amber-500/15 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute left-1/3 top-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/15 blur-3xl"
        />

        {/* Subtle grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
          {[...Array(8)].map((_, i) => (
            <div key={`h-${i}`} className="absolute h-px bg-white" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }} />
          ))}
          {[...Array(12)].map((_, i) => (
            <div key={`v-${i}`} className="absolute w-px bg-white" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }} />
          ))}
        </div>

        {/* Top logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Relay</span>
          </div>
        </motion.div>

        {/* Center content */}
        <div className="relative z-10 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h1 className="text-4xl font-bold leading-tight text-white">
              Start building
              <br />
              in seconds,
              <br />
              <span className="relative inline-block">
                not days
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 1, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute -bottom-1 left-0 right-0 h-2 origin-left rounded-full bg-white/20"
                />
              </span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-6 text-base leading-relaxed text-zinc-400"
          >
            Create your workspace and start delivering webhooks with confidence — no credit card required.
          </motion.p>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.5 }}
            className="mt-10 space-y-4"
          >
            {features.map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3 group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors group-hover:bg-white/15">
                  <item.icon className="h-4 w-4 text-zinc-300" />
                </div>
                <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="relative z-10 text-sm text-zinc-600"
        >
          &copy; {new Date().getFullYear()} Relay. All rights reserved.
        </motion.div>
      </div>

      {/* Right — registration form */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-background">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-center justify-center gap-2 lg:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <Zap className="h-4 w-4 text-background" />
            </div>
            <span className="text-lg font-semibold text-foreground">Relay</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-2 text-center lg:text-left"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground">Set up your Relay organization</p>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 space-y-5"
          >
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:bg-surface transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:bg-surface transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:bg-surface transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-foreground dark:hover:opacity-90"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                />
              ) : (
                <>
                  Create account
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </>
              )}
            </button>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-foreground hover:underline underline-offset-2 transition-all">
              Sign in
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
