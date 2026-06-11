import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { getAuthErrorMessage, isPasswordStrong, parseRecoveryTokens } from '@/lib/auth-utils'
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

type Status = 'initializing' | 'mfa_required' | 'mfa_verifying' | 'ready' | 'invalid' | 'expired' | 'updating' | 'success' | 'error'

export function ResetPasswordForm() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('initializing')
  const [statusMessage, setStatusMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaFactor, setMfaFactor] = useState<{ id: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const totpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function setupRecoverySession() {
      async function checkMfaRequirement() {
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
        if (cancelled) return
        if (factorsError) throw factorsError

        const verifiedFactor = factorsData.totp.find((factor) => factor.status === 'verified')
        if (verifiedFactor) {
          setMfaFactor(verifiedFactor)
          setStatus('mfa_required')
          return
        }
        setStatus('ready')
      }

      const tokens = parseRecoveryTokens()

      if (tokens.error) {
        if (cancelled) return
        setStatus('expired')
        setStatusMessage(
          tokens.error_description?.includes('expired')
            ? 'Deze reset-link is verlopen. Vraag een nieuwe aan.'
            : `Reset-link is ongeldig: ${tokens.error_description || tokens.error}`
        )
        return
      }

      // Geen tokens? Misschien heeft Supabase client ze al verwerkt → check sessie
      if (!tokens.access_token || !tokens.refresh_token) {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (data.session) {
          try {
            await checkMfaRequirement()
          } catch (err) {
            if (cancelled) return
            setStatus('error')
            setStatusMessage(getAuthErrorMessage(err))
          }
          return
        }
        setStatus('invalid')
        setStatusMessage(
          'Geen geldige reset-link gevonden. Vraag een nieuwe aan vanuit "Wachtwoord vergeten".'
        )
        return
      }

      if (tokens.type && tokens.type !== 'recovery') {
        if (cancelled) return
        setStatus('invalid')
        setStatusMessage(
          `Verkeerd type link ontvangen (${tokens.type}). Vraag een nieuwe reset-link aan.`
        )
        return
      }

      try {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })
        if (cancelled) return
        if (sessionError || !data.session) {
          console.error('setSession faalde:', sessionError)
          setStatus('expired')
          setStatusMessage(
            sessionError?.message?.toLowerCase().includes('expired')
              ? 'Deze reset-link is verlopen. Vraag een nieuwe aan.'
              : `Sessie kon niet opgezet worden: ${sessionError?.message || 'onbekende fout'}`
          )
          return
        }
        await checkMfaRequirement()
        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (err) {
        if (cancelled) return
        console.error('Onverwachte fout bij setSession:', err)
        setStatus('error')
        setStatusMessage(getAuthErrorMessage(err))
      }
    }

    setupRecoverySession()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactor || totpCode.length !== 6) return

    setError(null)
    setStatus('mfa_verifying')
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactor.id,
      })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactor.id,
        challengeId: challengeData.id,
        code: totpCode,
      })
      if (verifyError) throw verifyError

      setError(null)
      setStatus('ready')
    } catch {
      setError('Code is onjuist of verlopen. Probeer een nieuwe code uit je authenticator.')
      setTotpCode('')
      setStatus('mfa_required')
      window.setTimeout(() => totpInputRef.current?.focus(), 0)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isPasswordStrong(password)) {
      setError('Wachtwoord voldoet niet aan alle eisen.')
      return
    }
    if (password !== confirmPassword) {
      setError('De twee wachtwoorden komen niet overeen.')
      return
    }
    setStatus('updating')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setStatus('ready')
        setError(getAuthErrorMessage(updateError))
        return
      }
      setStatus('success')
      toast.success('Wachtwoord gewijzigd')
      setTimeout(() => navigate('/admin', { replace: true }), 1500)
    } catch (err) {
      setStatus('ready')
      setError(getAuthErrorMessage(err))
    }
  }

  if (status === 'initializing') {
    return (
      <div className="text-center space-y-3 py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Reset-link valideren...</p>
      </div>
    )
  }

  if (status === 'invalid' || status === 'expired' || status === 'error') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">
          {status === 'expired' ? 'Link verlopen' : 'Ongeldige link'}
        </h2>
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
        <div className="space-y-2">
          <Button onClick={() => navigate('/admin/wachtwoord-vergeten')} className="w-full">
            Nieuwe reset-link aanvragen
          </Button>
          <Button onClick={() => navigate('/admin/login')} variant="outline" className="w-full">
            Terug naar inloggen
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Wachtwoord gewijzigd</h2>
        <p className="text-sm text-muted-foreground">Je wordt nu doorgestuurd...</p>
      </div>
    )
  }

  if (status === 'mfa_required' || status === 'mfa_verifying') {
    const isVerifying = status === 'mfa_verifying'
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Bevestig met authenticator-code</h2>
          <p className="text-sm text-muted-foreground">
            Vul de 6-cijferige code uit je authenticator-app in om door te gaan met het wijzigen van je wachtwoord.
          </p>
        </div>
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-totp-code">Authenticator-code</Label>
            <Input
              ref={totpInputRef}
              id="reset-totp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              disabled={isVerifying}
              className="text-center font-mono text-2xl tracking-[0.5em]"
              required
            />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isVerifying || totpCode.length !== 6}>
            {isVerifying ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifiëren...</>
            ) : (
              'Verifieer en ga verder'
            )}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Kan je geen code genereren? Neem contact op met de beheerder.
        </p>
      </div>
    )
  }

  const isUpdating = status === 'updating'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Nieuw wachtwoord kiezen</h2>
        <p className="text-sm text-muted-foreground">
          Kies een sterk wachtwoord dat aan alle eisen voldoet.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isUpdating}
            required
            autoComplete="new-password"
            autoFocus
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrengthIndicator password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Herhaal wachtwoord</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isUpdating}
          required
          autoComplete="new-password"
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="text-xs text-destructive">Wachtwoorden komen niet overeen</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isUpdating} className="w-full">
        {isUpdating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wachtwoord wijzigen...
          </>
        ) : (
          'Wachtwoord wijzigen'
        )}
      </Button>
    </form>
  )
}
