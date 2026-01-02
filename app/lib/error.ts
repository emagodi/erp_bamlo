export function getErrorMessage(err: unknown, fallback = 'Something went wrong') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}
