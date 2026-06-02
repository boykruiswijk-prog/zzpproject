import { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function AuthLayout({ title, children }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">ZP Zaken admin</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          &copy; {new Date().getFullYear()} ZP Zaken B.V.
        </p>
      </div>
    </div>
  )
}
