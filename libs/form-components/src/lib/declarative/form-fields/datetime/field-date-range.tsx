'use client'

import { Box, Button, Field, Flex, HStack, Input, Menu, Portal } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import { LuCalendar, LuChevronDown } from 'react-icons/lu'
import type { BaseFieldProps } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Тип значения диапазона дат
 */
export interface DateRangeValue {
  start: string
  end: string
}

/**
 * Типы пресетов для быстрого выбора диапазона дат
 */
export type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear'

/**
 * Props для Form.Field.DateRange
 */
export interface DateRangeFieldProps extends BaseFieldProps {
  /** Label для начальной даты */
  startLabel?: string
  /** Label для конечной даты */
  endLabel?: string
  /** Placeholder для начальной даты */
  startPlaceholder?: string
  /** Placeholder для конечной даты */
  endPlaceholder?: string
  /** Минимальная дата (формат YYYY-MM-DD) */
  min?: string
  /** Максимальная дата (формат YYYY-MM-DD) */
  max?: string
  /** Включить кнопки пресетов */
  presets?: DateRangePreset[]
  /** Ориентация полей даты */
  orientation?: 'horizontal' | 'vertical'
  /** Размер */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

/**
 * Получить диапазон дат для пресета
 */
function getPresetRange(preset: DateRangePreset): DateRangeValue {
  const today = new Date()
  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      return { start: formatDate(yesterday), end: formatDate(yesterday) }
    }
    case 'thisWeek': {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Понедельник
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Воскресенье
      return { start: formatDate(startOfWeek), end: formatDate(endOfWeek) }
    }
    case 'lastWeek': {
      const startOfLastWeek = new Date(today)
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 6) // Прошлый понедельник
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6) // Прошлое воскресенье
      return { start: formatDate(startOfLastWeek), end: formatDate(endOfLastWeek) }
    }
    case 'thisMonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) }
    }
    case 'lastMonth': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) }
    }
    case 'thisYear': {
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      const endOfYear = new Date(today.getFullYear(), 11, 31)
      return { start: formatDate(startOfYear), end: formatDate(endOfYear) }
    }
  }
}

/**
 * Получить label для пресета
 */
function getPresetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case 'today':
      return 'Сегодня'
    case 'yesterday':
      return 'Вчера'
    case 'thisWeek':
      return 'Эта неделя'
    case 'lastWeek':
      return 'Прошлая неделя'
    case 'thisMonth':
      return 'Этот месяц'
    case 'lastMonth':
      return 'Прошлый месяц'
    case 'thisYear':
      return 'Этот год'
  }
}

/**
 * Form.Field.DateRange - Выбор диапазона дат с двумя полями
 *
 * Рендерит два поля даты для выбора диапазона с опциональными пресетами.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.DateRange name="period" label="Период" />
 * ```
 *
 * @example С пресетами
 * ```tsx
 * <Form.Field.DateRange
 *   name="period"
 *   label="Период"
 *   startLabel="С"
 *   endLabel="По"
 *   presets={['today', 'thisWeek', 'thisMonth']}
 * />
 * ```
 *
 * @example Вертикальная ориентация
 * ```tsx
 * <Form.Field.DateRange
 *   name="period"
 *   orientation="vertical"
 * />
 * ```
 */
export const FieldDateRange = createField<DateRangeFieldProps, DateRangeValue>({
  displayName: 'FieldDateRange',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      startLabel = 'Начало',
      endLabel = 'Конец',
      startPlaceholder,
      endPlaceholder,
      min,
      max,
      presets,
      orientation = 'horizontal',
      size = 'md',
    } = componentProps

    const value = (field.state.value as DateRangeValue) ?? { start: '', end: '' }

    const handleStartChange = (newStart: string) => {
      field.handleChange({ ...value, start: newStart })
    }

    const handleEndChange = (newEnd: string) => {
      field.handleChange({ ...value, end: newEnd })
    }

    const handlePreset = (preset: DateRangePreset) => {
      field.handleChange(getPresetRange(preset))
    }

    const Container = orientation === 'horizontal' ? HStack : Box

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />

        <Flex gap={2} direction={orientation === 'horizontal' ? 'row' : 'column'} align="stretch" width="full">
          <Container gap={2} flex={1} alignItems="flex-end">
            {/* Начальная дата */}
            <Box flex={1}>
              <Field.Root disabled={resolved.disabled} readOnly={resolved.readOnly}>
                <Field.Label fontSize="sm" color="fg.muted">
                  {startLabel}
                </Field.Label>
                <Input
                  type="date"
                  value={value.start}
                  onChange={(e) => handleStartChange((e.target as HTMLInputElement).value)}
                  onBlur={field.handleBlur}
                  placeholder={startPlaceholder}
                  min={min}
                  max={value.end || max}
                  size={size}
                  data-field-name={`${fullPath}.start`}
                />
              </Field.Root>
            </Box>

            {/* Конечная дата */}
            <Box flex={1}>
              <Field.Root disabled={resolved.disabled} readOnly={resolved.readOnly}>
                <Field.Label fontSize="sm" color="fg.muted">
                  {endLabel}
                </Field.Label>
                <Input
                  type="date"
                  value={value.end}
                  onChange={(e) => handleEndChange((e.target as HTMLInputElement).value)}
                  onBlur={field.handleBlur}
                  placeholder={endPlaceholder}
                  min={value.start || min}
                  max={max}
                  size={size}
                  data-field-name={`${fullPath}.end`}
                />
              </Field.Root>
            </Box>
          </Container>

          {/* Меню пресетов */}
          {presets && presets.length > 0 && !resolved.readOnly && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button variant="outline" size={size} disabled={resolved.disabled}>
                  <LuCalendar />
                  Пресеты
                  <LuChevronDown />
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {presets.map((preset) => (
                      <Menu.Item key={preset} value={preset} onClick={() => handlePreset(preset)}>
                        {getPresetLabel(preset)}
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}
        </Flex>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})
