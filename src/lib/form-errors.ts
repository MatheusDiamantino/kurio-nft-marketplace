import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/api/client'

export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  fieldMap: Partial<Record<string, Path<T>>> = {},
): string | null {
  if (!isApiError(error)) return 'Erro inesperado. Tente novamente.'
  const entries = Object.entries(error.fields)
  let first = true
  for (const [apiField, message] of entries) {
    const field = (fieldMap[apiField] ?? apiField) as Path<T>
    form.setError(field, { type: 'server', message }, { shouldFocus: first })
    first = false
  }
  return entries.length > 0 ? null : error.message
}
