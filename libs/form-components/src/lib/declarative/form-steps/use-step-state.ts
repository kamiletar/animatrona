'use client'

import { useCallback, useMemo, useState } from 'react'
import type { StepInfo } from './form-steps-context'

/**
 * Результат хука useStepState
 */
export interface UseStepStateResult {
  /** Зарегистрированные шаги, отсортированные по индексу */
  sortedSteps: StepInfo[]
  /** Количество шагов */
  stepCount: number
  /** Регистрация шага */
  registerStep: (step: StepInfo) => void
  /** Удаление регистрации шага */
  unregisterStep: (index: number) => void
  /** Скрытые поля (исключаются из валидации) */
  hiddenFields: Set<string>
  /** Скрыть поля от валидации */
  hideFieldsFromValidation: (fieldNames: string[]) => void
  /** Показать поля для валидации */
  showFieldsForValidation: (fieldNames: string[]) => void
}

/**
 * Хук для управления состоянием шагов
 *
 * Управляет:
 * - Регистрацией/удалением шагов
 * - Сортировкой шагов по индексу
 * - Скрытыми полями (для Form.When интеграции)
 *
 * @example
 * ```tsx
 * const {
 *   sortedSteps,
 *   stepCount,
 *   registerStep,
 *   unregisterStep,
 *   hiddenFields,
 *   hideFieldsFromValidation,
 *   showFieldsForValidation
 * } = useStepState()
 * ```
 */
export function useStepState(): UseStepStateResult {
  // Зарегистрированные шаги
  const [steps, setSteps] = useState<StepInfo[]>([])

  // Скрытые поля (исключаются из валидации через Form.When)
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set())

  // Сортировка шагов по индексу
  const sortedSteps = useMemo(() => [...steps].sort((a, b) => a.index - b.index), [steps])

  const stepCount = sortedSteps.length

  // Регистрация шага
  const registerStep = useCallback((step: StepInfo) => {
    setSteps((prev) => {
      // Заменяем если уже существует с таким индексом
      const existing = prev.findIndex((s) => s.index === step.index)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = step
        return next
      }
      return [...prev, step]
    })
  }, [])

  // Удаление регистрации шага
  const unregisterStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((s) => s.index !== index))
  }, [])

  // Скрыть поля от валидации (вызывается из Form.When при скрытии)
  const hideFieldsFromValidation = useCallback((fieldNames: string[]) => {
    setHiddenFields((prev) => {
      const next = new Set(prev)
      for (const name of fieldNames) {
        next.add(name)
      }
      return next
    })
  }, [])

  // Показать поля для валидации (вызывается из Form.When при показе)
  const showFieldsForValidation = useCallback((fieldNames: string[]) => {
    setHiddenFields((prev) => {
      const next = new Set(prev)
      for (const name of fieldNames) {
        next.delete(name)
      }
      return next
    })
  }, [])

  return {
    sortedSteps,
    stepCount,
    registerStep,
    unregisterStep,
    hiddenFields,
    hideFieldsFromValidation,
    showFieldsForValidation,
  }
}
