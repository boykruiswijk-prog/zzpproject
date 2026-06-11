import { useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getAuthErrorMessage, isPasswordStrong } from '@/lib/auth-utils'
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'password' | 'mfa'>('password')
  const [mfaFactor, setMfaFactor] = useState<{ id: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const totpInputRef = useRef<HTMLInputElement>(null)

  async function updatePassword() {
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) throw updateError

    toast.success('Wachtwoord gewijzigd')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTotpCode('')
    setMfaFactor(null)
    setStep('password')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isPasswordStrong(newPassword)) {
      setError('Nieuw wachtwoord voldoet niet aan alle eisen.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('De twee nieuwe wachtwoorden komen niet overeen.')
      return
    }
    if (currentPassword === newPassword) {
      setError('Nieuw wachtwoord moet verschillen van het huidige.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Geen actieve sessie gevonden. Log opnieuw in.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        setError('Huidig wachtwoord is onjuist.')
        return
      }

      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const verifiedFactor = factorsData.totp.find((factor) => factor.status === 'verified')
      if (verifiedFactor) {
        setMfaFactor(verifiedFactor)
        setStep('mfa')
        return
      }

      await updatePassword()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactor || totpCode.length !== 6) return

    setError(null)
    setLoading(true)
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

      await updatePassword()
    } catch (err) {
      const authMessage = getAuthErrorMessage(err)
      setError(
        authMessage.startsWith('Code is') || authMessage.startsWith('De code is')
          ? 'Code is onjuist of verlopen. Probeer een nieuwe code uit je authenticator.'
          : authMessage
      )
      setTotpCode('')
      window.setTimeout(() => totpInputRef.current?.focus(), 0)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'mfa') {
    return (
      <div className="max-w-md space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Bevestig met authenticator-code</h2>
          <p className="text-sm text-muted-foreground">
            Vul de 6-cijferige code uit je authenticator-app in om door te gaan met het wijzigen van je wachtwoord.
          </p>
        </div>
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="change-password-totp-code">Authenticator-code</Label>
            <Input
              ref={totpInputRef}
              id="change-password-totp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              className="text-center font-mono text-2xl tracking-[0.5em]"
              required
            />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <Button type="submit" disabled={loading || totpCode.length !== 6} className="w-full">
            {loading ? (
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Huidig wachtwoord</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            type={showPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
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
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
        <Input
          id="newPassword"
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="new-password"
        />
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Herhaal nieuw wachtwoord</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wijzigen...
          </>
        ) : (
          'Wachtwoord wijzigen'
        )}
      </Button>
    </form>
  )
}
