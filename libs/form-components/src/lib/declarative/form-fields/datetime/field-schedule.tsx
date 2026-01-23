'use client'

import { Box, Button, Field, HStack, Input, Stack, Text } from '@chakra-ui/react'
import type { AnyFieldApi } from '@tanstack/react-form'
import { memo, useCallback, useMemo, type ReactElement, type ReactNode } from 'react'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { FieldError, FieldLabel, getFieldErrors, useResolvedFieldProps } from '../base'

/**
 * Временной слот
 */
export interface TimeSlot {
  open: string
  close: string
}

/**
 * Расписание на день (null = выходной)
 */
export type DaySchedule = TimeSlot | null

/**
 * Недельное расписание
 */
export interface WeeklySchedule {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

/**
 * День недели
 */
export type DayOfWeek = keyof WeeklySchedule

/**
 * Конфигурация дней
 */
const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DEFAULT_DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
}

const DEFAULT_WORKING_HOURS: WeeklySchedule = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: null,
  sunday: null,
}

/**
 * Константы для стилизации кастомного switch
 * Используется нативный checkbox вместо Chakra Switch для совместимости с RHF
 */
const SWITCH_STYLES = {
  /** Ширина трека switch */
  trackWidth: '36px',
  /** Высота трека switch */
  trackHeight: '20px',
  /** Размер круглого индикатора (thumb) */
  thumbSize: '16px',
  /** Отступ thumb от края (2px с каждой стороны для центрирования в 20px треке) */
  thumbOffset: '2px',
  /** Позиция thumb во включённом состоянии (trackWidth - thumbSize - thumbOffset = 36 - 16 - 2 = 18) */
  thumbEnabledLeft: '18px',
} as const

/**
 * Проверяет что время окончания после времени начала
 */
function isValidTimeRange(open: string, close: string): boolean {
  const [openH, openM] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  return closeMinutes > openMinutes
}

/**
 * Внутренний компонент для рендеринга расписания.
 * Вынесен отдельно для соблюдения правил React хуков.
 */
interface ScheduleContentProps {
  field: AnyFieldApi
  schedule: WeeklySchedule
  defaultSchedule: WeeklySchedule
  days: DayOfWeek[]
  mergedDayNames: Record<DayOfWeek, string>
  showCopyToWeekdays: boolean
  offLabel: string
  copyToWeekdaysLabel: string
  defaultOpenTime: string
  defaultCloseTime: string
  disabled?: boolean
  readOnly?: boolean
  resolvedLabel?: ReactNode
  resolvedHelperText?: ReactNode
  resolvedRequired?: boolean
  resolvedTooltip?: FieldTooltipMeta
  fullPath: string
}

const ScheduleContent = memo(function ScheduleContent({
  field,
  schedule,
  days,
  mergedDayNames,
  showCopyToWeekdays,
  offLabel,
  copyToWeekdaysLabel,
  defaultOpenTime,
  defaultCloseTime,
  disabled,
  readOnly,
  resolvedLabel,
  resolvedHelperText,
  resolvedRequired,
  resolvedTooltip,
  fullPath,
}: ScheduleContentProps) {
  const { hasError, errorMessage } = getFieldErrors(field)

  // Проверка невалидных временных диапазонов
  const invalidDays = useMemo(() => {
    const invalid: DayOfWeek[] = []
    for (const day of days) {
      const daySchedule = schedule[day]
      if (daySchedule && !isValidTimeRange(daySchedule.open, daySchedule.close)) {
        invalid.push(day)
      }
    }
    return invalid
  }, [schedule, days])

  const handleDayToggle = useCallback(
    (day: DayOfWeek, enabled: boolean) => {
      const newSchedule = {
        ...schedule,
        [day]: enabled ? { open: defaultOpenTime, close: defaultCloseTime } : null,
      }
      field.handleChange(newSchedule)
    },
    [schedule, field, defaultOpenTime, defaultCloseTime]
  )

  const handleTimeChange = useCallback(
    (day: DayOfWeek, timeField: 'open' | 'close', value: string) => {
      const current = schedule[day]
      if (!current) {
        return
      }
      const newSchedule = {
        ...schedule,
        [day]: { ...current, [timeField]: value },
      }
      field.handleChange(newSchedule)
    },
    [schedule, field]
  )

  const handleCopyToWeekdays = useCallback(() => {
    const mondaySchedule = schedule.monday
    if (!mondaySchedule) {
      return
    }
    const newSchedule = {
      ...schedule,
      monday: mondaySchedule,
      tuesday: mondaySchedule,
      wednesday: mondaySchedule,
      thursday: mondaySchedule,
      friday: mondaySchedule,
    }
    field.handleChange(newSchedule)
  }, [schedule, field])

  return (
    <Field.Root
      invalid={hasError}
      required={resolvedRequired}
      disabled={disabled}
      readOnly={readOnly}
      data-field-name={fullPath}
    >
      <FieldLabel label={resolvedLabel} tooltip={resolvedTooltip} required={resolvedRequired} />

      <Stack gap={3}>
        {/* Предупреждение о невалидных диапазонах */}
        {invalidDays.length > 0 && (
          <Box p={3} bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md">
            <Text color="red.600" fontSize="sm" fontWeight="medium">
              Время окончания должно быть позже времени начала: {invalidDays.map((d) => mergedDayNames[d]).join(', ')}
            </Text>
          </Box>
        )}

        {/* Быстрые действия */}
        {showCopyToWeekdays && days.includes('monday') && (
          <HStack gap={2} flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              Быстрые действия:
            </Text>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              colorPalette="blue"
              onClick={handleCopyToWeekdays}
              disabled={disabled || readOnly || !schedule.monday}
            >
              {copyToWeekdaysLabel}
            </Button>
          </HStack>
        )}

        {/* Список дней */}
        {days.map((day) => {
          const daySchedule = schedule[day]
          const isEnabled = daySchedule !== null && daySchedule !== undefined
          const dayHasError = invalidDays.includes(day)

          return (
            <Box
              key={day}
              data-day={day}
              p={3}
              bg={dayHasError ? 'red.50' : isEnabled ? 'bg.panel' : 'bg.muted'}
              borderRadius="md"
              borderWidth={dayHasError ? '2px' : '1px'}
              borderColor={dayHasError ? 'red.300' : 'border.muted'}
            >
              <HStack justify="space-between" flexWrap="wrap" gap={3}>
                {/* День и переключатель */}
                <HStack gap={3} minW="140px">
                  {/* Нативный чекбокс стилизованный как switch */}
                  <Box
                    as="label"
                    display="inline-flex"
                    alignItems="center"
                    cursor={disabled || readOnly ? 'not-allowed' : 'pointer'}
                    position="relative"
                    opacity={disabled || readOnly ? 0.4 : 1}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => handleDayToggle(day, e.target.checked)}
                      disabled={disabled || readOnly}
                      data-switch={day}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 0,
                        height: 0,
                      }}
                    />
                    <Box
                      w={SWITCH_STYLES.trackWidth}
                      h={SWITCH_STYLES.trackHeight}
                      bg={isEnabled ? 'green.500' : 'gray.300'}
                      borderRadius="full"
                      position="relative"
                      transition="background 0.2s"
                    >
                      <Box
                        position="absolute"
                        top={SWITCH_STYLES.thumbOffset}
                        left={isEnabled ? SWITCH_STYLES.thumbEnabledLeft : SWITCH_STYLES.thumbOffset}
                        w={SWITCH_STYLES.thumbSize}
                        h={SWITCH_STYLES.thumbSize}
                        bg="white"
                        borderRadius="full"
                        transition="left 0.2s"
                        boxShadow="sm"
                      />
                    </Box>
                  </Box>
                  <Text fontWeight="medium" color={isEnabled ? 'fg' : 'fg.muted'}>
                    {mergedDayNames[day]}
                  </Text>
                </HStack>

                {/* Поля времени */}
                {isEnabled ? (
                  <HStack gap={2}>
                    <Input
                      type="time"
                      size="sm"
                      width="120px"
                      value={daySchedule?.open || defaultOpenTime}
                      onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                      disabled={disabled || readOnly}
                    />
                    <Text color="fg.muted">—</Text>
                    <Input
                      type="time"
                      size="sm"
                      width="120px"
                      value={daySchedule?.close || defaultCloseTime}
                      onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                      disabled={disabled || readOnly}
                    />
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    {offLabel}
                  </Text>
                )}
              </HStack>
            </Box>
          )
        })}
      </Stack>

      <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolvedHelperText} />
    </Field.Root>
  )
})

/**
 * Props для Schedule поля
 */
export interface ScheduleFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta

  /**
   * Кастомные названия дней (для локализации)
   */
  dayNames?: Partial<Record<DayOfWeek, string>>

  /**
   * Расписание по умолчанию при пустом значении
   */
  defaultSchedule?: WeeklySchedule

  /**
   * Дни для отображения (подмножество всех дней)
   * @default все дни
   */
  days?: DayOfWeek[]

  /**
   * Показывать кнопку "скопировать на будни"
   * @default true
   */
  showCopyToWeekdays?: boolean

  /**
   * Текст для состояния "выходной"
   * @default 'Выходной'
   */
  offLabel?: string

  /**
   * Текст кнопки копирования на будни
   * @default 'Скопировать Пн на будни'
   */
  copyToWeekdaysLabel?: string

  /**
   * Время открытия по умолчанию при включении дня
   */
  defaultOpenTime?: string

  /**
   * Время закрытия по умолчанию при включении дня
   */
  defaultCloseTime?: string
}

/**
 * Form.Field.Schedule - Редактор недельного расписания
 *
 * Рендерит редактор расписания рабочих часов с переключателями
 * и полями времени для каждого дня недели.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Schedule
 *   name="workingHours"
 *   label="Рабочие часы"
 * />
 * ```
 *
 * @example С кастомными названиями дней
 * ```tsx
 * <Form.Field.Schedule
 *   name="schedule"
 *   dayNames={{
 *     monday: 'Пн',
 *     tuesday: 'Вт',
 *     // ...
 *   }}
 *   offLabel="Выходной"
 *   copyToWeekdaysLabel="Скопировать Пн на будни"
 * />
 * ```
 *
 * @example Только будние дни
 * ```tsx
 * <Form.Field.Schedule
 *   name="hours"
 *   days={['monday', 'tuesday', 'wednesday', 'thursday', 'friday']}
 * />
 * ```
 */
export function FieldSchedule({
  name,
  label,
  helperText,
  required,
  disabled,
  readOnly,
  tooltip,
  dayNames = {},
  defaultSchedule = DEFAULT_WORKING_HOURS,
  days = DAYS_OF_WEEK,
  showCopyToWeekdays = true,
  offLabel = 'Выходной',
  copyToWeekdaysLabel = 'Скопировать Пн на будни',
  defaultOpenTime = '09:00',
  defaultCloseTime = '18:00',
}: ScheduleFieldProps): ReactElement {
  const {
    form,
    fullPath,
    label: resolvedLabel,
    helperText: resolvedHelperText,
    tooltip: resolvedTooltip,
    required: resolvedRequired,
    disabled: resolvedDisabled,
    readOnly: resolvedReadOnly,
  } = useResolvedFieldProps(name, { label, helperText, required, disabled, readOnly, tooltip })

  // Объединение названий дней
  const mergedDayNames = { ...DEFAULT_DAY_NAMES, ...dayNames }

  return (
    <form.Field name={fullPath}>
      {(field: AnyFieldApi) => {
        const schedule: WeeklySchedule = (field.state.value as WeeklySchedule) || defaultSchedule

        return (
          <ScheduleContent
            field={field}
            schedule={schedule}
            defaultSchedule={defaultSchedule}
            days={days}
            mergedDayNames={mergedDayNames}
            showCopyToWeekdays={showCopyToWeekdays}
            offLabel={offLabel}
            copyToWeekdaysLabel={copyToWeekdaysLabel}
            defaultOpenTime={defaultOpenTime}
            defaultCloseTime={defaultCloseTime}
            disabled={resolvedDisabled}
            readOnly={resolvedReadOnly}
            resolvedLabel={resolvedLabel}
            resolvedHelperText={resolvedHelperText}
            resolvedRequired={resolvedRequired}
            resolvedTooltip={resolvedTooltip}
            fullPath={fullPath}
          />
        )
      }}
    </form.Field>
  )
}
