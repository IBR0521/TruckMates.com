/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup
 */

interface EnvConfig {
  required: string[]
  optional: string[]
  defaults?: Record<string, string>
}

const envConfig: EnvConfig = {
  required: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],
  optional: [
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'RESEND_API_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_MAPS_API_KEY',
    'QUICKBOOKS_CLIENT_ID',
    'QUICKBOOKS_CLIENT_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ],
  defaults: {
    NODE_ENV: 'development',
  },
}

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const key of envConfig.required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`)
    }
  }

  // Check optional but recommended variables
  const recommended = ['NEXT_PUBLIC_SENTRY_DSN', 'RESEND_API_KEY']
  for (const key of recommended) {
    if (!process.env[key] && process.env.NODE_ENV === 'production') {
      warnings.push(`Recommended environment variable not set: ${key}`)
    }
  }

  // Validate format of known variables
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
  }

  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) {
    errors.push('NEXT_PUBLIC_APP_URL must be a valid URL')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// Validate on module load (server-side only)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  const validation = validateEnv()
  
  if (!validation.valid) {
    console.error('❌ Environment validation failed:')
    validation.errors.forEach(error => console.error(`  - ${error}`))
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Environment validation failed. Please check your environment variables.')
    }
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:')
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }
}

