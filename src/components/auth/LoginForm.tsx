import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { MFAVerify } from '@/components/admin/MFAVerify'
import { MFAEnroll } from '@/components/admin/MFAEnroll'

type Step = 'credentials' | 'mfa_verify' | 'mfa_enroll'

interface GuardStatus {
  locked: boolean
  minutesLeft: number
  attemptsLeft: number
}

const OPEN_GUARD: GuardStatus = { locked: false, minutesLeft: 0, attemptsLeft: 5 }

async function callLoginGuard(body: Record<string, unknown>): Promise<GuardStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('login-guard', { body })
    if (error || !data) return OPEN_GUARD
    return {
      locked: data.locked === true,
      minutesLeft: Number(data.minutesLeft ?? 0),
      attemptsLeft: Number(data.attemptsLeft ?? 0),
    }
  } catch {
    return OPEN_GUARD
  }
}

const checkLoginGuard = (email: string) => callLoginGuard({ action: 'check', email })
const recordLoginAttempt = (email: string, success: boolean) =>
  callLoginGuard({ action: 'record', email, success })

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('credentials')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Vul e-mailadres en wachtwoord in.')
      return
    }

    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      // Bescherming tegen wachtwoord-raden: na 5 mislukte pogingen een afkoelperiode.
      const guard = await checkLoginGuard(normalizedEmail)
      if (guard.locked) {
        setError(
          `Te veel mislukte inlogpogingen. Probeer het over ${guard.minutesLeft} ${
            guard.minutesLeft === 1 ? 'minuut' : 'minuten'
          } opnieuw.`,
        )
        return
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (authError) {
        const after = await recordLoginAttempt(normalizedEmail, false)
        let msg = getAuthErrorMessage(authError)
        if (after.locked) {
          msg = `Te veel mislukte inlogpogingen. Probeer het over ${after.minutesLeft} ${
            after.minutesLeft === 1 ? 'minuut' : 'minuten'
          } opnieuw.`
        } else if (after.attemptsLeft > 0 && after.attemptsLeft <= 2) {
          msg += ` Nog ${after.attemptsLeft} ${
            after.attemptsLeft === 1 ? 'poging' : 'pogingen'
          } voordat het account tijdelijk wordt geblokkeerd.`
        }
        setError(msg)
        return
      }
      void recordLoginAttempt(normalizedEmail, true)
      if (!data.session) {
        setError('Login geslaagd maar geen sessie ontvangen. Probeer opnieuw.')
        return
      }

      // MFA check (verplicht voor /admin)
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const verified = factorsData?.totp.filter((f) => f.status === 'verified') || []
      if (verified.length > 0) {
        setStep('mfa_verify')
        return
      }
      setStep('mfa_enroll')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelMfa() {
    await supabase.auth.signOut()
    setStep('credentials')
    setPassword('')
  }

  if (step === 'mfa_verify') {
    return (
      <MFAVerify
        onVerified={() => {
          toast.success('Welkom terug')
          navigate('/admin', { replace: true })
        }}
        onCancel={handleCancelMfa}
      />
    )
  }
  if (step === 'mfa_enroll') {
    return <MFAEnroll onEnrolled={() => navigate('/admin', { replace: true })} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Wachtwoord</Label>
          <Link
            to="/admin/wachtwoord-vergeten"
            className="text-xs text-primary hover:underline"
          >
            Wachtwoord vergeten?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Inloggen...
          </>
        ) : (
          'Inloggen'
        )}
      </Button>
    </form>
  )
}
