import { AdminLayout } from '@/components/admin/AdminLayout'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'

export default function ChangePasswordPage() {
  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-bold">Wachtwoord wijzigen</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Wijzig het wachtwoord van je admin-account.
        </p>
        <ChangePasswordForm />
      </div>
    </AdminLayout>
  )
}
