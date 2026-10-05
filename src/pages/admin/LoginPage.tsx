import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Loader2 } from 'lucide-react'

type Niveau = 'check' | 'aal2' | 'code' | 'instellen' | 'geen'

/** Alleen interne admin-paden als terugkeeradres (geen open redirect). */
function veiligDoel(next: string | null): string {
  if (!next || next.startsWith('//') || next.startsWith('/admin/login')) return '/admin'
  return /^\/admin(\/|\?|#|$)/.test(next) ? next : '/admin'
}

export default function LoginPage() {
  const { user, isTeamMember, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const doel = veiligDoel(searchParams.get('next'))
  const [niveau, setNiveau] = useState<Niveau>('check')

  useEffect(() => {
    if (isLoading) return
    if (!user) { setNiveau('geen'); return }
    let actief = true
    setNiveau('check')
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!actief) return
      if (data?.currentLevel === 'aal2') setNiveau('aal2')
      else if (data?.nextLevel === 'aal2') setNiveau('code')
      else setNiveau(isTeamMember ? 'instellen' : 'geen')
    })
    return () => { actief = false }
  }, [user, isTeamMember, isLoading])

  if (isLoading || niveau === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Alleen met een aal2-sessie door naar de admin.
  if (user && isTeamMember && niveau === 'aal2') {
    return <Navigate to={doel} replace />
  }

  const beginStap = niveau === 'code' ? 'mfa_verify' : niveau === 'instellen' ? 'mfa_enroll' : 'credentials'

  return (
    <AuthLayout title="Inloggen">
      <LoginForm key={beginStap} doel={doel} beginStap={beginStap} />
    </AuthLayout>
  )
}
