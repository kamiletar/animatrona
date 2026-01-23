'use client'

import { Box, Field, Input, List, Spinner, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { AddressFieldProps, AddressValue, DaDataSuggestion } from '../../types'
import { createField, FieldError, FieldLabel, useDebounce } from '../base'

/**
 * Состояние для поля адреса
 */
interface AddressFieldState {
  /** Текущее значение ввода */
  inputValue: string
  /** Установить значение ввода */
  setInputValue: (value: string) => void
  /** Список подсказок */
  suggestions: DaDataSuggestion[]
  /** Установить подсказки */
  setSuggestions: (suggestions: DaDataSuggestion[]) => void
  /** Индикатор загрузки */
  isLoading: boolean
  /** Установить индикатор загрузки */
  setIsLoading: (loading: boolean) => void
  /** Открыт ли выпадающий список */
  isOpen: boolean
  /** Установить состояние открытия */
  setIsOpen: (open: boolean) => void
  /** Индекс выделенного элемента */
  highlightedIndex: number
  /** Установить индекс выделенного элемента */
  setHighlightedIndex: (index: number) => void
  /** Ref контейнера */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Debounced значение запроса */
  debouncedQuery: string
  /** Функция загрузки подсказок */
  fetchSuggestions: (query: string) => Promise<void>
}

/**
 * Form.Field.Address - Ввод адреса с подсказками DaData
 *
 * Рендерит поле адреса с автодополнением из DaData API.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Address
 *   name="address"
 *   label="Адрес"
 *   token={process.env.NEXT_PUBLIC_DADATA_TOKEN}
 * />
 * ```
 *
 * @example С ограничением по локации
 * ```tsx
 * <Form.Field.Address
 *   name="address"
 *   token={token}
 *   locations={[{ city: 'Москва' }]}
 * />
 * ```
 *
 * @example Вернуть только строковое значение
 * ```tsx
 * <Form.Field.Address name="address" token={token} valueOnly />
 * ```
 */
export const FieldAddress = createField<AddressFieldProps, AddressValue | string, AddressFieldState>({
  displayName: 'FieldAddress',

  useFieldState: (props) => {
    const { token, minChars = 3, debounceMs = 300, locations } = props

    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<DaDataSuggestion[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const debouncedQuery = useDebounce(inputValue, debounceMs)

    // Функция загрузки подсказок из DaData
    const fetchSuggestions = useCallback(
      async (query: string) => {
        if (query.length < minChars) {
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
              Authorization: `Token ${token}`,
            },
            body: JSON.stringify({
              query,
              count: 10,
              locations: locations,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            setSuggestions(data.suggestions || [])
            setIsOpen(true)
          }
        } catch (error) {
          console.error('Ошибка загрузки DaData:', error)
          setSuggestions([])
        } finally {
          setIsLoading(false)
        }
      },
      [token, minChars, locations]
    )

    // Загрузка при изменении debounced запроса
    useEffect(() => {
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
      fetchSuggestions,
    }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const { valueOnly = false } = componentProps
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

    const fieldValue = field.state.value as AddressValue | string | undefined

    // Инициализация значения ввода из field (только при монтировании)
    useEffect(() => {
      if (fieldValue) {
        const displayValue = typeof fieldValue === 'string' ? fieldValue : fieldValue.value
        if (displayValue && displayValue !== inputValue) {
          setInputValue(displayValue)
        }
      }
    }, [])

    // Обработчик выбора подсказки
    const handleSelect = (suggestion: DaDataSuggestion) => {
      setInputValue(suggestion.value)
      setIsOpen(false)
      setSuggestions([])

      if (valueOnly) {
        field.handleChange(suggestion.value)
      } else {
        const addressValue: AddressValue = {
          value: suggestion.value,
          data: suggestion.data,
        }
        field.handleChange(addressValue)
      }
    }

    // Обработчик клавиатурной навигации
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) {
        return
      }

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
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setIsOpen(true)
              }
            }}
            onBlur={field.handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={resolved.placeholder ?? 'Начните вводить адрес...'}
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
              maxH="200px"
              overflowY="auto"
              mt={1}
            >
              {suggestions.map((suggestion, index) => (
                <List.Item
                  key={suggestion.value + index}
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
