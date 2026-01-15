/**
 * Professional validation utilities for TruckMates
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validate phone number (US format)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  // US phone numbers should be 10 or 11 digits
  return digits.length === 10 || (digits.length === 11 && digits[0] === '1')
}

/**
 * Validate US ZIP code
 */
export function validateZipCode(zip: string): boolean {
  if (!zip) return false
  const zipRegex = /^\d{5}(-\d{4})?$/
  return zipRegex.test(zip.trim())
}

/**
 * Validate US state code (2 letters)
 */
export function validateStateCode(state: string): boolean {
  if (!state) return false
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]
  return validStates.includes(state.toUpperCase().trim())
}

/**
 * Validate VIN (Vehicle Identification Number)
 */
export function validateVIN(vin: string): boolean {
  if (!vin) return false
  // VIN should be 17 characters, alphanumeric (excluding I, O, Q)
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i
  return vinRegex.test(vin.trim().toUpperCase())
}

/**
 * Validate license plate (flexible format)
 */
export function validateLicensePlate(plate: string): boolean {
  if (!plate) return false
  // Allow alphanumeric, 2-8 characters
  const plateRegex = /^[A-Z0-9]{2,8}$/i
  return plateRegex.test(plate.trim())
}

/**
 * Validate date string (YYYY-MM-DD format)
 */
export function validateDate(dateString: string): boolean {
  if (!dateString) return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Validate date is in the future
 */
export function validateFutureDate(dateString: string): boolean {
  if (!validateDate(dateString)) return false
  const date = new Date(dateString)
  return date > new Date()
}

/**
 * Validate date is in the past
 */
export function validatePastDate(dateString: string): boolean {
  if (!validateDate(dateString)) return false
  const date = new Date(dateString)
  return date < new Date()
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: number | string | undefined | null): boolean {
  if (value === undefined || value === null) return false
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num > 0
}

/**
 * Validate non-negative number
 */
export function validateNonNegativeNumber(value: number | string | undefined | null): boolean {
  if (value === undefined || value === null) return false
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= 0
}

/**
 * Validate percentage (0-100)
 */
export function validatePercentage(value: number | string | undefined | null): boolean {
  if (value === undefined || value === null) return false
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= 0 && num <= 100
}

/**
 * Validate required string
 */
export function validateRequiredString(value: string | undefined | null, minLength = 1, maxLength?: number): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length < minLength) return false
  if (maxLength && trimmed.length > maxLength) return false
  return true
}

/**
 * Sanitize string input (remove dangerous characters, trim)
 */
export function sanitizeString(input: string | undefined | null, maxLength?: number): string {
  if (!input || typeof input !== 'string') return ''
  let sanitized = input.trim()
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '')
  
  // Limit length if specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  return sanitized
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return ''
  return email.trim().toLowerCase()
}

/**
 * Sanitize phone number (remove formatting, keep digits)
 */
export function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Validate and sanitize address
 */
export function validateAddress(address: {
  street?: string
  city?: string
  state?: string
  zip?: string
}): ValidationResult {
  const errors: string[] = []

  if (address.street && !validateRequiredString(address.street, 5, 200)) {
    errors.push('Street address must be between 5 and 200 characters')
  }

  if (address.city && !validateRequiredString(address.city, 2, 100)) {
    errors.push('City must be between 2 and 100 characters')
  }

  if (address.state && !validateStateCode(address.state)) {
    errors.push('Invalid state code')
  }

  if (address.zip && !validateZipCode(address.zip)) {
    errors.push('Invalid ZIP code format (use 12345 or 12345-6789)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate load data
 */
export function validateLoadData(data: {
  origin?: string
  destination?: string
  weight?: number | string
  value?: number
  estimated_delivery?: string
  load_date?: string
}): ValidationResult {
  const errors: string[] = []

  if (!validateRequiredString(data.origin, 1, 200)) {
    errors.push('Origin is required and must be between 1 and 200 characters')
  }

  if (!validateRequiredString(data.destination, 1, 200)) {
    errors.push('Destination is required and must be between 1 and 200 characters')
  }

  if (data.weight !== undefined && data.weight !== null) {
    if (!validatePositiveNumber(data.weight)) {
      errors.push('Weight must be a positive number')
    }
  }

  if (data.value !== undefined && data.value !== null) {
    if (!validateNonNegativeNumber(data.value)) {
      errors.push('Value must be a non-negative number')
    }
  }

  if (data.estimated_delivery && !validateDate(data.estimated_delivery)) {
    errors.push('Invalid estimated delivery date format (use YYYY-MM-DD)')
  }

  if (data.load_date && !validateDate(data.load_date)) {
    errors.push('Invalid load date format (use YYYY-MM-DD)')
  }

  if (data.load_date && data.estimated_delivery) {
    const loadDate = new Date(data.load_date)
    const deliveryDate = new Date(data.estimated_delivery)
    if (deliveryDate < loadDate) {
      errors.push('Estimated delivery date must be after load date')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate driver data
 */
export function validateDriverData(data: {
  name?: string
  email?: string
  phone?: string
  license_number?: string
  license_state?: string
  license_expiry?: string
}): ValidationResult {
  const errors: string[] = []

  if (!validateRequiredString(data.name, 2, 100)) {
    errors.push('Driver name is required and must be between 2 and 100 characters')
  }

  if (data.email && !validateEmail(data.email)) {
    errors.push('Invalid email format')
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Invalid phone number format')
  }

  if (data.license_number && !validateRequiredString(data.license_number, 5, 20)) {
    errors.push('License number must be between 5 and 20 characters')
  }

  if (data.license_state && !validateStateCode(data.license_state)) {
    errors.push('Invalid license state code')
  }

  if (data.license_expiry && !validateDate(data.license_expiry)) {
    errors.push('Invalid license expiry date format (use YYYY-MM-DD)')
  }

  if (data.license_expiry) {
    const expiryDate = new Date(data.license_expiry)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (expiryDate < today) {
      errors.push('License expiry date cannot be in the past')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate truck data
 */
export function validateTruckData(data: {
  truck_number?: string
  vin?: string
  license_plate?: string
  year?: number
  mileage?: number
}): ValidationResult {
  const errors: string[] = []

  if (!validateRequiredString(data.truck_number, 1, 50)) {
    errors.push('Truck number is required and must be between 1 and 50 characters')
  }

  if (data.vin && !validateVIN(data.vin)) {
    errors.push('Invalid VIN format (must be 17 alphanumeric characters, excluding I, O, Q)')
  }

  if (data.license_plate && !validateLicensePlate(data.license_plate)) {
    errors.push('Invalid license plate format')
  }

  if (data.year !== undefined && data.year !== null) {
    const currentYear = new Date().getFullYear()
    if (data.year < 1900 || data.year > currentYear + 1) {
      errors.push(`Year must be between 1900 and ${currentYear + 1}`)
    }
  }

  if (data.mileage !== undefined && data.mileage !== null) {
    if (!validateNonNegativeNumber(data.mileage)) {
      errors.push('Mileage must be a non-negative number')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate pricing data
 */
export function validatePricingData(data: {
  rate?: number
  fuel_surcharge?: number
  accessorial_charges?: number
  discount?: number
  total_rate?: number
}): ValidationResult {
  const errors: string[] = []

  if (data.rate !== undefined && data.rate !== null) {
    if (!validateNonNegativeNumber(data.rate)) {
      errors.push('Rate must be a non-negative number')
    }
  }

  if (data.fuel_surcharge !== undefined && data.fuel_surcharge !== null) {
    if (!validateNonNegativeNumber(data.fuel_surcharge)) {
      errors.push('Fuel surcharge must be a non-negative number')
    }
  }

  if (data.accessorial_charges !== undefined && data.accessorial_charges !== null) {
    if (!validateNonNegativeNumber(data.accessorial_charges)) {
      errors.push('Accessorial charges must be a non-negative number')
    }
  }

  if (data.discount !== undefined && data.discount !== null) {
    if (!validateNonNegativeNumber(data.discount)) {
      errors.push('Discount must be a non-negative number')
    }
    if (data.rate && data.discount > data.rate) {
      errors.push('Discount cannot exceed rate')
    }
  }

  if (data.total_rate !== undefined && data.total_rate !== null) {
    if (!validateNonNegativeNumber(data.total_rate)) {
      errors.push('Total rate must be a non-negative number')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}






