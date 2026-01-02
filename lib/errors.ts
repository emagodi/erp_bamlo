export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'An unexpected error occurred.';
  }
}
