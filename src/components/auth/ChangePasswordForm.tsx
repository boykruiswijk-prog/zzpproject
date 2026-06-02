import { useState } from 'react'
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

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError(getAuthErrorMessage(updateError))
        return
      }

      toast.success('Wachtwoord gewijzigd')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
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
