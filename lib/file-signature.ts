const MAGIC_BYTES_MAX_LENGTH = 16

function bytesStartWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false
  }
  return true
}

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === "image/jpg") return "image/jpeg"
  return normalized
}

export async function detectMimeTypeFromMagicBytes(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, MAGIC_BYTES_MAX_LENGTH).arrayBuffer())

  // PDF: 25 50 44 46 ("%PDF")
  if (bytesStartWith(header, [0x25, 0x50, 0x44, 0x46])) {
    return "application/pdf"
  }

  // JPEG: FF D8 FF
  if (bytesStartWith(header, [0xff, 0xd8, 0xff])) {
    return "image/jpeg"
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytesStartWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }

  // GIF87a / GIF89a
  if (
    bytesStartWith(header, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    bytesStartWith(header, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif"
  }

  // WebP: RIFF....WEBP
  if (
    bytesStartWith(header, [0x52, 0x49, 0x46, 0x46]) &&
    header.length >= 12 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp"
  }

  return null
}

export async function validateFileMagicBytes(
  file: File,
  allowedMimeTypes: readonly string[],
): Promise<{ valid: boolean; normalizedDeclaredType: string; detectedType: string | null }> {
  const normalizedDeclaredType = normalizeMimeType(file.type || "")
  const normalizedAllowed = allowedMimeTypes.map((m) => normalizeMimeType(m))

  if (!normalizedDeclaredType || !normalizedAllowed.includes(normalizedDeclaredType)) {
    return { valid: false, normalizedDeclaredType, detectedType: null }
  }

  const detectedType = await detectMimeTypeFromMagicBytes(file)
  if (!detectedType) {
    return { valid: false, normalizedDeclaredType, detectedType }
  }

  const valid = normalizedDeclaredType === detectedType && normalizedAllowed.includes(detectedType)
  return { valid, normalizedDeclaredType, detectedType }
}
