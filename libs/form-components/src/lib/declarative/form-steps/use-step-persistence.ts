'use client'

import { useCallback, useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'form-steps:'

/**
 * Конфигурация персистенции шага формы
 */
export interface StepPersistenceConfig {
  /**
   * Уникальный ключ для localStorage
   * Должен быть уникален для каждой формы
   */
  key: string

  /**
   * Задержка debounce для сохранения в миллисекундах
   * @default 300
   */
  debounceMs?: number
}

/**
 * Результат хука useStepPersistence
 */
export interface UseStepPersistenceResult {
  /** Получить сохранённый шаг из localStorage */
  getPersistedStep: () => number | null
  /** Очистить сохранённый шаг */
  clearPersistence: () => void
}

/**
 * Хук для персистенции текущего шага в localStorage
 *
 * Сохраняет и восстанавливает индекс текущего шага автоматически.
 * Использует debounce для оптимизации записи.
 *
 * @example
 * ```tsx
 * const { getPersistedStep, clearPersistence } = useStepPersistence(
 *   currentStep,
 *   { key: 'my-form', debounceMs: 300 }
 * )
 * ```
 */
export function useStepPersistence(
  currentStep: number,
  config?: StepPersistenceConfig,
): UseStepPersistenceResult {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Используем ref для config — предотвращает перезапуск useEffect
  // при каждом рендере из-за смены ссылки на объект
  const configRef = useRef(config)
  configRef.current = config

  // Получить сохранённый шаг при монтировании
  const getPersistedStep = useCallback((): number | null => {
    const cfg = configRef.current
    if (!cfg || typeof window === 'undefined') {
      return null
    }
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${cfg.key}`)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed
        }
      }
    } catch {
      // Invalid или ошибка localStorage — игнорируем
    }
    return null
  }, [])

  // Сохранение шага с debounce — зависит только от currentStep
  useEffect(() => {
    const cfg = configRef.current
    if (!cfg || typeof window === 'undefined') {
      return
    }

    const debounceMs = cfg.debounceMs ?? 300

    // Отменяем предыдущий таймер
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounced сохранение
    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${cfg.key}`, String(currentStep))
      } catch {
        // localStorage может быть переполнен или отключён
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [currentStep])

  // Очистить персистенцию (вызывать после успешной отправки формы)
  const clearPersistence = useCallback(() => {
    const cfg = configRef.current
    if (!cfg || typeof window === 'undefined') {
      return
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${cfg.key}`)
    } catch {
      // Игнорируем ошибки
    }
  }, [])

  return { getPersistedStep, clearPersistence }
}
