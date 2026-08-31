export const createError = (message: string, code: number) => {
  const error = new Error(message) as Error & { code: number }
  error.code = code
  return error
}
