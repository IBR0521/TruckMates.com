/**
 * HTML escaping utility to prevent XSS attacks
 */

export function escapeHtml(text: string | null | undefined): string {
  if (!text) return ""
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  
  return String(text).replace(/[&<>"']/g, (c) => map[c] || c)
}

