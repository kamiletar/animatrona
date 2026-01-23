'use client'

import type { AnyFormApi } from '@tanstack/react-form'
import { useCallback, useState } from 'react'
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
 * @example
 * ```tsx
 * const {
 *   direction,
 *   goToNext,
 *   goToPrev,
 *   goToStep,
 *   skipToEnd,
 *   triggerSubmit,
 *   validateCurrentStep
 * } = useStepNavigation({ ... })
 * ```
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

  // Валидация полей текущего шага (исключая скрытые поля)
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    if (!validateOnNext) {
      return true
    }

    const currentStepInfo = sortedSteps[currentStep]
    if (!currentStepInfo || currentStepInfo.fieldNames.length === 0) {
      return true
    }

    // Фильтруем скрытые поля — они не должны валидироваться
    const visibleFieldNames = currentStepInfo.fieldNames.filter((name) => !hiddenFields.has(name))

    if (visibleFieldNames.length === 0) {
      return true
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
  }, [form, currentStep, sortedSteps, validateOnNext, hiddenFields])

  // Переход к следующему шагу
  const goToNext = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep()
    if (!isValid) {
      return false
    }

    const currentStepInfo = sortedSteps[currentStep]

    // Вызываем onLeave callback если есть (может отменить переход)
    if (currentStepInfo?.onLeave) {
      const canLeave = await currentStepInfo.onLeave('forward')
      if (!canLeave) {
        return false
      }
    }

    // Вызываем onStepComplete callback
    if (onStepComplete) {
      await onStepComplete(currentStep, form.state.values)
    }

    const nextStep = currentStep + 1
    if (nextStep < stepCount) {
      setDirection('forward')
      if (controlledStep === undefined) {
        setInternalStep(nextStep)
      }
      onStepChange?.(nextStep)

      // Вызываем onEnter callback следующего шага
      const nextStepInfo = sortedSteps[nextStep]
      if (nextStepInfo?.onEnter) {
        nextStepInfo.onEnter()
      }

      return true
    }
    return false
  }, [
    currentStep,
    stepCount,
    controlledStep,
    onStepChange,
    validateCurrentStep,
    sortedSteps,
    onStepComplete,
    form,
    setInternalStep,
  ])

  // Переход к предыдущему шагу
  const goToPrev = useCallback(async () => {
    const prevStep = currentStep - 1
    if (prevStep >= 0) {
      const currentStepInfo = sortedSteps[currentStep]

      // Вызываем onLeave callback если есть (может отменить переход)
      if (currentStepInfo?.onLeave) {
        const canLeave = await currentStepInfo.onLeave('backward')
        if (!canLeave) {
          return
        }
      }

      setDirection('backward')
      if (controlledStep === undefined) {
        setInternalStep(prevStep)
      }
      onStepChange?.(prevStep)

      // Вызываем onEnter callback предыдущего шага
      const prevStepInfo = sortedSteps[prevStep]
      if (prevStepInfo?.onEnter) {
        prevStepInfo.onEnter()
      }
    }
  }, [currentStep, controlledStep, onStepChange, sortedSteps, setInternalStep])

  // Переход к конкретному шагу
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < stepCount) {
        // Определяем направление на основе разницы шагов
        setDirection(step > currentStep ? 'forward' : 'backward')
        if (controlledStep === undefined) {
          setInternalStep(step)
        }
        onStepChange?.(step)
      }
    },
    [stepCount, currentStep, controlledStep, onStepChange, setInternalStep]
  )

  // Пропустить до конца (без валидации)
  const skipToEnd = useCallback(() => {
    setDirection('forward')
    if (controlledStep === undefined) {
      setInternalStep(stepCount) // За последний шаг — состояние completed
    }
    onStepChange?.(stepCount)
  }, [stepCount, controlledStep, onStepChange, setInternalStep])

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
