'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useFormGroup } from '../form-group'
import { useDeclarativeForm } from './form-context'

/**
 * Result type for useFieldActions hook
 */
export interface FieldActionsResult<TValue = unknown> {
  /** Current field value */
  value: TValue
  /** Set field value */
  onChange: (value: TValue) => void
  /** Set field error */
  setError: (error: string) => void
  /** Clear field error */
  clearError: () => void
  /** Trigger field validation */
  validate: () => Promise<void>
  /** Whether field is touched */
  isTouched: boolean
  /** Whether field has errors */
  hasError: boolean
  /** Current field errors (array) */
  errors: string[]
}

/**
 * Hook for imperative field actions.
 *
 * Useful for custom field actions like geolocation detection,
 * async value fetching, or programmatic field manipulation.
 *
 * @param fieldName - Field name (relative to current group context)
 * @returns Field actions object with value, onChange, setError, etc.
 *
 * @example Basic usage with geolocation
 * ```tsx
 * function CityField() {
 *   const { value, onChange, setError } = useFieldActions('city')
 *
 *   const handleDetect = async () => {
 *     const result = await detectLocation()
 *     if (result.error) {
 *       setError(result.error)
 *     } else {
 *       onChange(result.city)
 *     }
 *   }
 *
 *   return (
 *     <HStack>
 *       <Form.Field.String name="city" label="City" />
 *       <Button onClick={handleDetect}>
 *         <LuMapPin />
 *       </Button>
 *     </HStack>
 *   )
 * }
 * ```
 *
 * @example Async value fetching
 * ```tsx
 * function CompanyField() {
 *   const { onChange, setError } = useFieldActions('company')
 *   const [isLoading, setIsLoading] = useState(false)
 *
 *   const handleLookup = async (inn: string) => {
 *     setIsLoading(true)
 *     try {
 *       const company = await lookupByInn(inn)
 *       onChange(company.name)
 *     } catch (e) {
 *       setError('Company not found')
 *     } finally {
 *       setIsLoading(false)
 *     }
 *   }
 *
 *   return <Button onClick={() => handleLookup('1234567890')} loading={isLoading}>Lookup</Button>
 * }
 * ```
 */
export function useFieldActions<TValue = unknown>(fieldName: string): FieldActionsResult<TValue> {
  const { form } = useDeclarativeForm()
  const parentGroup = useFormGroup()

  // Build full field path
  const fullPath = parentGroup ? `${parentGroup.name}.${fieldName}` : fieldName

  // Get nested value from form state
  const getNestedValue = useCallback(
    (values: Record<string, unknown>): TValue => {
      const parts = fullPath.split('.')
      let result: unknown = values
      for (const part of parts) {
        if (result && typeof result === 'object') {
          result = (result as Record<string, unknown>)[part]
        } else {
          return undefined as TValue
        }
      }
      return result as TValue
    },
    [fullPath]
  )

  // Subscribe to field value changes
  const value = useSyncExternalStore(
    useCallback(
      (callback: () => void) => {
        return form.store.subscribe(callback)
      },
      [form]
    ),
    useCallback(() => {
      return getNestedValue(form.state.values as Record<string, unknown>)
    }, [form, getNestedValue]),
    useCallback(() => {
      return getNestedValue(form.state.values as Record<string, unknown>)
    }, [form, getNestedValue])
  )

  // Get field meta (errors, touched, etc.)
  const fieldMeta = useSyncExternalStore(
    useCallback(
      (callback: () => void) => {
        return form.store.subscribe(callback)
      },
      [form]
    ),
    useCallback(() => {
      const meta = form.store.state.fieldMeta[fullPath]
      return meta || { errors: [], isTouched: false }
    }, [form, fullPath]),
    useCallback(() => {
      const meta = form.store.state.fieldMeta[fullPath]
      return meta || { errors: [], isTouched: false }
    }, [form, fullPath])
  )

  // Set field value
  const onChange = useCallback(
    (newValue: TValue) => {
      form.setFieldValue(fullPath, newValue)
    },
    [form, fullPath]
  )

  // Set field error
  const setError = useCallback(
    (error: string) => {
      form.setFieldMeta(fullPath, (prev: Record<string, unknown>) => ({
        ...prev,
        errors: [error],
      }))
    },
    [form, fullPath]
  )

  // Clear field error
  const clearError = useCallback(() => {
    form.setFieldMeta(fullPath, (prev: Record<string, unknown>) => ({
      ...prev,
      errors: [],
    }))
  }, [form, fullPath])

  // Trigger field validation
  const validate = useCallback(async () => {
    await form.validateField(fullPath, 'change')
  }, [form, fullPath])

  const errors = (fieldMeta.errors as string[]) || []

  return {
    value,
    onChange,
    setError,
    clearError,
    validate,
    isTouched: Boolean(fieldMeta.isTouched),
    hasError: errors.length > 0,
    errors,
  }
}
