interface ErrorMessageProps {
  message: string | null | undefined
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
      {message}
    </p>
  )
}
