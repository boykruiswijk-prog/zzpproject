import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { AuthLayout } from '@/components/auth/AuthLayout'

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Nieuw wachtwoord">
      <ResetPasswordForm />
    </AuthLayout>
  )
}
