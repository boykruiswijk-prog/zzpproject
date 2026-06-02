import { checkPasswordRequirements, passwordStrengthScore } from '@/lib/auth-utils'
import { Check, X } from 'lucide-react'

interface Props {
  password: string
}

export function PasswordStrengthIndicator({ password }: Props) {
  const requirements = checkPasswordRequirements(password)
  const score = passwordStrengthScore(password)

  const barColor =
    score < 40 ? 'bg-red-500' :
    score < 70 ? 'bg-amber-500' :
    score < 90 ? 'bg-blue-500' : 'bg-green-500'

  const label =
    score < 40 ? 'Zwak' :
    score < 70 ? 'Redelijk' :
    score < 90 ? 'Sterk' : 'Zeer sterk'

  if (!password) return null

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-16 text-right">{label}</span>
      </div>
      <ul className="space-y-1">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={req.met ? 'text-foreground' : 'text-muted-foreground'}>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
