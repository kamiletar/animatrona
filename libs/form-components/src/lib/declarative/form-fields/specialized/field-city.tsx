'use client'

import { Box, Field, Input, List, Spinner, Text } from '@chakra-ui/react'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import type { BaseFieldProps } from '../../types'
import { createField, FieldError, FieldLabel, useDebounce } from '../base'

/**
 * Пропсы для поля выбора города
 */
export interface CityFieldProps extends BaseFieldProps {
  /** Токен API DaData (по умолчанию: NEXT_PUBLIC_DADATA_API_KEY) */
  token?: string
  /** Минимум символов перед поиском (по умолчанию: 2) */
  minChars?: number
  /** Задержка debounce в мс (по умолчанию: 300) */
  debounceMs?: number
}

/**
 * Состояние поля города
 */
interface CityFieldState {
  inputValue: string
  setInputValue: (value: string) => void
  suggestions: Array<{
    value: string
    data: {
      city: string | null
      settlement: string | null
      city_fias_id: string | null
      region_with_type: string | null
    }
  }>
  setSuggestions: (suggestions: CityFieldState['suggestions']) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  highlightedIndex: number
  setHighlightedIndex: (index: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  debouncedQuery: string
}

/**
 * Form.Field.City — выбор города с подсказками DaData
 *
 * Использует DaData API с from_bound/to_bound для ограничения до уровня города/населённого пункта.
 * Возвращает строковое значение (название города).
 *
 * @example
 * ```tsx
 * <Form.Field.City name="city" label="Город" />
 * ```
 *
 * @example С кастомным токеном
 * ```tsx
 * <Form.Field.City name="city" token="your-token" />
 * ```
 */
export const FieldCity = createField<CityFieldProps, string, CityFieldState>({
  displayName: 'FieldCity',

  useFieldState: (props) => {
    const { token, minChars = 2, debounceMs = 300 } = props
    const apiKey = token || (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_DADATA_API_KEY : '') || ''

    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<CityFieldState['suggestions']>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const debouncedQuery = useDebounce(inputValue, debounceMs)
    // Флаг: только что выбрали город, пропустить следующий fetch
    const justSelectedRef = useRef(false)
    // Флаг: inputValue уже инициализирован из значения поля
    const initializedRef = useRef(false)

    // Загрузка подсказок городов из DaData
    const fetchSuggestions = useCallback(
      async (query: string) => {
        if (query.length < minChars || !apiKey) {
          setSuggestions([])
          return
        }

        setIsLoading(true)
        try {
          const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Token ${apiKey}`,
            },
            body: JSON.stringify({
              query,
              count: 7,
              from_bound: { value: 'city' },
              to_bound: { value: 'settlement' },
            }),
          })

          if (response.ok) {
            const data = await response.json()
            setSuggestions(data.suggestions || [])
            setIsOpen(data.suggestions?.length > 0)
          }
        } catch (error) {
          console.error('Ошибка загрузки городов DaData:', error)
          setSuggestions([])
        } finally {
          setIsLoading(false)
        }
      },
      [apiKey, minChars]
    )

    // Загрузка при изменении debounced запроса
    useEffect(() => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false
        return
      }

      if (debouncedQuery) {
        fetchSuggestions(debouncedQuery)
      } else {
        setSuggestions([])
        setIsOpen(false)
      }
    }, [debouncedQuery, fetchSuggestions])

    // Закрытие при клике вне
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return {
      inputValue,
      setInputValue,
      suggestions,
      setSuggestions,
      isLoading,
      setIsLoading,
      isOpen,
      setIsOpen,
      highlightedIndex,
      setHighlightedIndex,
      containerRef,
      debouncedQuery,
      justSelectedRef,
      initializedRef,
    } as CityFieldState & { justSelectedRef: React.RefObject<boolean>; initializedRef: React.RefObject<boolean> }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, fieldState }): ReactElement => {
    const {
      inputValue,
      setInputValue,
      suggestions,
      setSuggestions,
      isLoading,
      isOpen,
      setIsOpen,
      highlightedIndex,
      setHighlightedIndex,
      containerRef,
    } = fieldState
    const { justSelectedRef, initializedRef } = fieldState as CityFieldState & {
      justSelectedRef: React.RefObject<boolean>
      initializedRef: React.RefObject<boolean>
    }

    const fieldValue = field.state.value as string | undefined

    // Инициализация значения ввода из field (однократно, без useEffect)
    if (!initializedRef.current && fieldValue && fieldValue !== inputValue) {
      initializedRef.current = true
      setInputValue(fieldValue)
    }

    // Обработчик выбора города
    const handleSelect = (suggestion: CityFieldState['suggestions'][number]) => {
      const cityName = suggestion.data.city || suggestion.data.settlement || suggestion.value
      justSelectedRef.current = true
      setInputValue(cityName)
      setIsOpen(false)
      setSuggestions([])
      field.handleChange(cityName)
    }

    // Клавиатурная навигация
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(highlightedIndex < suggestions.length - 1 ? highlightedIndex + 1 : 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(highlightedIndex > 0 ? highlightedIndex - 1 : suggestions.length - 1)
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0) {
            handleSelect(suggestions[highlightedIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          break
      }
    }

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
        <Box ref={containerRef} position="relative" width="100%">
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setHighlightedIndex(-1)
              // Если пользователь стирает текст, обновляем значение формы
              if (!e.target.value) {
                field.handleChange('')
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true)
            }}
            onBlur={field.handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={resolved.placeholder ?? 'Введите город'}
            data-field-name={fullPath}
          />
          {isLoading && (
            <Box position="absolute" right={3} top="50%" transform="translateY(-50%)">
              <Spinner size="sm" />
            </Box>
          )}
          {isOpen && suggestions.length > 0 && (
            <List.Root
              position="absolute"
              zIndex={10}
              width="100%"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="md"
              shadow="md"
              maxH="250px"
              overflowY="auto"
              mt={1}
              listStyle="none"
            >
              {suggestions.map((suggestion, index) => (
                <List.Item
                  key={`${suggestion.data.city_fias_id}-${index}`}
                  px={3}
                  py={2}
                  cursor="pointer"
                  bg={highlightedIndex === index ? 'bg.muted' : undefined}
                  _hover={{ bg: 'bg.muted' }}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <Text fontSize="sm">{suggestion.value}</Text>
                </List.Item>
              ))}
            </List.Root>
          )}
        </Box>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})
