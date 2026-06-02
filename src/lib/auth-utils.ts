import type { AuthError } from '@supabase/supabase-js'

// Vertaal Supabase auth errors naar Nederlandse, behulpzame meldingen.
export function getAuthErrorMessage(error: AuthError | Error | null | unknown): string {
  if (!error) return ''
  const anyErr = error as { message?: string; code?: string; status?: number }
  const msg = (anyErr?.message || String(error) || '').toLowerCase()
  const code = anyErr?.code || ''
  const status = anyErr?.status || 0

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'E-mailadres of wachtwoord onjuist.'
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Je e-mailadres is nog niet bevestigd. Check je inbox.'
  }
  if (code === 'user_not_found' || msg.includes('user not found')) {
    return 'Als dit e-mailadres bekend is, ontvang je een reset-link.'
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit')) {
    return 'Te veel verzoeken. Wacht een minuut en probeer opnieuw.'
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Te veel pogingen. Wacht even en probeer opnieuw.'
  }
  if (code === 'same_password' || msg.includes('new password should be different')) {
    return 'Het nieuwe wachtwoord moet verschillen van het huidige.'
  }
  if (code === 'weak_password' || msg.includes('password should')) {
    return 'Wachtwoord is te zwak. Gebruik minimaal 12 tekens met hoofdletter, cijfer en leesteken.'
  }
  if (msg.includes('expired') || msg.includes('invalid token') || msg.includes('jwt expired')) {
    return 'De link is verlopen of al gebruikt. Vraag een nieuwe aan.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Geen verbinding. Controleer je internet en probeer opnieuw.'
  }
  return `Er ging iets mis: ${anyErr?.message || 'onbekende fout'}. Probeer het opnieuw of neem contact op met de beheerder.`
}

export interface PasswordRequirement {
  label: string
  met: boolean
}

export function checkPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'Minimaal 12 tekens', met: password.length >= 12 },
    { label: 'Bevat een hoofdletter', met: /[A-Z]/.test(password) },
    { label: 'Bevat een kleine letter', met: /[a-z]/.test(password) },
    { label: 'Bevat een cijfer', met: /[0-9]/.test(password) },
    { label: 'Bevat een leesteken', met: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(password) },
  ]
}

export function isPasswordStrong(password: string): boolean {
  return checkPasswordRequirements(password).every((r) => r.met)
}

export function passwordStrengthScore(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 15
  if (password.length >= 12) score += 20
  if (password.length >= 16) score += 15
  if (/[A-Z]/.test(password)) score += 10
  if (/[a-z]/.test(password)) score += 10
  if (/[0-9]/.test(password)) score += 10
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(password)) score += 15
  if (/(.)\1{2,}/.test(password)) score -= 10
  return Math.max(0, Math.min(100, score))
}

export function isRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return hash.includes('type=recovery') || hash.includes('access_token')
}

export function parseRecoveryTokens(): {
  access_token: string | null
  refresh_token: string | null
  type: string | null
  error: string | null
  error_description: string | null
} {
  if (typeof window === 'undefined') {
    return { access_token: null, refresh_token: null, type: null, error: null, error_description: null }
  }
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error'),
    error_description: params.get('error_description'),
  }
}
