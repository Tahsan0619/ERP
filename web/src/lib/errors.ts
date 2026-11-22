export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message
    if (typeof msg === 'string' && msg.length > 0) return msg
  }
  return fallback
}