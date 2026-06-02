import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { user, isTeamMember, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user && isTeamMember) {
    return <Navigate to="/admin" replace />
  }

  return (
    <AuthLayout title="Inloggen">
      <LoginForm />
    </AuthLayout>
  )
}
