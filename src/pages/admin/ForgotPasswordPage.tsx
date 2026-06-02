import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { AuthLayout } from '@/components/auth/AuthLayout'

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Wachtwoord vergeten">
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
