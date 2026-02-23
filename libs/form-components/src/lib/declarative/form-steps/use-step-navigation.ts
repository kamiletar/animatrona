'use client'

import type { AnyFormApi } from '@tanstack/react-form'
import { useCallback, useRef, useState } from 'react'
import type { StepDirection, StepInfo } from './form-steps-context'

/**
 * Параметры хука useStepNavigation
 */
export interface UseStepNavigationParams {
  /** TanStack Form API */
  form: AnyFormApi
  /** Текущий индекс шага */
  currentStep: number
  /** Общее количество шагов */
  stepCount: number
  /** Отсортированные шаги */
  sortedSteps: StepInfo[]
  /** Скрытые поля (исключаются из валидации) */
  hiddenFields: Set<string>
  /** Контролируемый шаг извне */
  controlledStep?: number
  /** Callback при изменении шага */
  onStepChange?: (step: number) => void
  /** Callback при завершении шага */
  onStepComplete?: (stepIndex: number, values: unknown) => Promise<void> | void
  /** Валидировать при переходе к следующему шагу */
  validateOnNext?: boolean
  /** Setter для внутреннего состояния шага */
  setInternalStep: (step: number) => void
}

/**
 * Результат хука useStepNavigation
 */
export interface UseStepNavigationResult {
  /** Направление перехода (для анимации) */
  direction: StepDirection
  /** Перейти к следующему шагу (с валидацией) */
  goToNext: () => Promise<boolean>
  /** Перейти к предыдущему шагу */
  goToPrev: () => Promise<void>
  /** Перейти к конкретному шагу */
  goToStep: (step: number) => void
  /** Пропустить до конца (без валидации) */
  skipToEnd: () => void
  /** Запустить отправку формы */
  triggerSubmit: () => void
  /** Валидировать текущий шаг */
  validateCurrentStep: () => Promise<boolean>
}

/**
 * Хук для навигации между шагами формы
 *
 * Управляет:
 * - Переходами между шагами
 * - Валидацией перед переходом
 * - Направлением анимации
 * - Callbacks шагов (onEnter, onLeave)
 *
 * ВАЖНО: Все callback'и используют refs для нестабильных значений (sortedSteps, stepCount,
 * currentStep, hiddenFields, onStepChange, onStepComplete). Это предотвращает пересоздание
 * callback'ов при каждой регистрации шага, что вызывало бесконечный цикл:
 * registerStep → новый sortedSteps/stepCount → новые callback'и → новый contextValue →
 * ре-рендер → повторная регистрация → бесконечный цикл.
 */
export function useStepNavigation({
  form,
  currentStep,
  stepCount,
  sortedSteps,
  hiddenFields,
  controlledStep,
  onStepChange,
  onStepComplete,
  validateOnNext = true,
  setInternalStep,
}: UseStepNavigationParams): UseStepNavigationResult {
  // Направление анимации (для slide эффекта)
  const [direction, setDirection] = useState<StepDirection>('forward')

  // Все нестабильные значения через refs — callback'и НИКОГДА не пересоздаются
  const sortedStepsRef = useRef(sortedSteps)
  sortedStepsRef.current = sortedSteps

  const stepCountRef = useRef(stepCount)
  stepCountRef.current = stepCount

  const currentStepRef = useRef(currentStep)
  currentStepRef.current = currentStep

  const hiddenFieldsRef = useRef(hiddenFields)
  hiddenFieldsRef.current = hiddenFields

  const onStepChangeRef = useRef(onStepChange)
  onStepChangeRef.current = onStepChange

  const onStepCompleteRef = useRef(onStepComplete)
  onStepCompleteRef.current = onStepComplete

  const controlledStepRef = useRef(controlledStep)
  controlledStepRef.current = controlledStep

  const validateOnNextRef = useRef(validateOnNext)
  validateOnNextRef.current = validateOnNext

  // Валидация полей текущего шага (исключая скрытые поля)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    if (!validateOnNextRef.current) {
      return true
    }

    const currentStepInfo = sortedStepsRef.current[currentStepRef.current]
    if (!currentStepInfo || currentStepInfo.fieldNames.length === 0) {
      return true
    }

    // Фильтруем скрытые поля — они не должны валидироваться
    const visibleFieldNames = currentStepInfo.fieldNames.filter((name) => !hiddenFieldsRef.current.has(name))

    if (visibleFieldNames.length === 0) {
      return true
    }

    // Помечаем поля как touched для показа ошибок
    for (const fieldName of visibleFieldNames) {
      form.setFieldMeta(fieldName, (prev) => ({
        ...prev,
        isTouched: true,
      }))
    }

    // Валидируем каждое видимое поле текущего шага
    for (const fieldName of visibleFieldNames) {
      await form.validateField(fieldName, 'change')
    }

    // Проверяем наличие ошибок
    const state = form.store.state
    for (const fieldName of visibleFieldNames) {
      const fieldMeta = state.fieldMeta[fieldName]
      if (fieldMeta?.errors && fieldMeta.errors.length > 0) {
        return false
      }
    }

    return true
  }, [form])

  // Переход к следующему шагу
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goToNext = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep()
    if (!isValid) {
      return false
    }

    const step = currentStepRef.current
    const currentStepInfo = sortedStepsRef.current[step]

    // Вызываем onLeave callback если есть (может отменить переход)
    if (currentStepInfo?.onLeave) {
      const canLeave = await currentStepInfo.onLeave('forward')
      if (!canLeave) {
        return false
      }
    }

    // Вызываем onStepComplete callback
    if (onStepCompleteRef.current) {
      await onStepCompleteRef.current(step, form.state.values)
    }

    const nextStep = step + 1
    if (nextStep < stepCountRef.current) {
      setDirection('forward')
      if (controlledStepRef.current === undefined) {
        setInternalStep(nextStep)
      }
      onStepChangeRef.current?.(nextStep)

      // Вызываем onEnter callback следующего шага
      const nextStepInfo = sortedStepsRef.current[nextStep]
      if (nextStepInfo?.onEnter) {
        nextStepInfo.onEnter()
      }

      return true
    }
    return false
  }, [form, validateCurrentStep, setInternalStep])

  // Переход к предыдущему шагу
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goToPrev = useCallback(async () => {
    const step = currentStepRef.current
    const prevStep = step - 1
    if (prevStep >= 0) {
      const currentStepInfo = sortedStepsRef.current[step]

      // Вызываем onLeave callback если есть (может отменить переход)
      if (currentStepInfo?.onLeave) {
        const canLeave = await currentStepInfo.onLeave('backward')
        if (!canLeave) {
          return
        }
      }

      setDirection('backward')
      if (controlledStepRef.current === undefined) {
        setInternalStep(prevStep)
      }
      onStepChangeRef.current?.(prevStep)

      // Вызываем onEnter callback предыдущего шага
      const prevStepInfo = sortedStepsRef.current[prevStep]
      if (prevStepInfo?.onEnter) {
        prevStepInfo.onEnter()
      }
    }
  }, [setInternalStep])

  // Переход к конкретному шагу
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < stepCountRef.current) {
        setDirection(step > currentStepRef.current ? 'forward' : 'backward')
        if (controlledStepRef.current === undefined) {
          setInternalStep(step)
        }
        onStepChangeRef.current?.(step)
      }
    },
    [setInternalStep],
  )

  // Пропустить до конца (без валидации)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skipToEnd = useCallback(() => {
    const count = stepCountRef.current
    setDirection('forward')
    if (controlledStepRef.current === undefined) {
      setInternalStep(count) // За последний шаг — состояние completed
    }
    onStepChangeRef.current?.(count)
  }, [setInternalStep])

  // Программный запуск отправки формы
  const triggerSubmit = useCallback(() => {
    form.handleSubmit()
  }, [form])

  return {
    direction,
    goToNext,
    goToPrev,
    goToStep,
    skipToEnd,
    triggerSubmit,
    validateCurrentStep,
  }
}
