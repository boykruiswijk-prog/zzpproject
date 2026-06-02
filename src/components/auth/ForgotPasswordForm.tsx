import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) {
      setError('Vul je e-mailadres in.')
      return
    }
    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/admin/wachtwoord-reset`
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      )
      if (authError) {
        console.warn('Reset password error:', authError)
        const status = (authError as { status?: number }).status
        if (authError.message?.toLowerCase().includes('rate') || status === 429) {
          setError(getAuthErrorMessage(authError))
          return
        }
      }
      setSubmitted(true)
    } catch (err) {
      console.error('Onverwachte fout reset request:', err)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Check je mail</h2>
        <p className="text-sm text-muted-foreground">
          Als {email} bekend is in ons systeem, hebben we een reset-link gestuurd. Open de mail en
          klik op de link om een nieuw wachtwoord te kiezen.
        </p>
        <p className="text-xs text-muted-foreground">
          De link is 1 uur geldig. Check ook je spam-folder.
        </p>
        <Link
          to="/admin/login"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar inloggen
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Wachtwoord vergeten</h2>
        <p className="text-sm text-muted-foreground">
          Vul je e-mailadres in. We sturen een link waarmee je een nieuw wachtwoord kunt instellen.
        </p>
      </div>

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

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Versturen...
          </>
        ) : (
          'Stuur reset-link'
        )}
      </Button>

      <div className="text-center">
        <Link
          to="/admin/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar inloggen
        </Link>
      </div>
    </form>
  )
}
