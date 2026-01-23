'use client'

import { Button, CloseButton, Dialog, Portal, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'

/**
 * Конфигурация сохранения формы
 */
export interface FormPersistenceConfig {
  /**
   * Уникальный ключ для localStorage
   * Должен быть уникальным для каждой формы во избежание конфликтов
   */
  key: string

  /**
   * Задержка debounce в миллисекундах для сохранения
   * @default 500
   */
  debounceMs?: number

  /**
   * Время жизни черновика в миллисекундах (TTL)
   * После истечения TTL черновик считается протухшим и автоматически удаляется
   * @example 24 * 60 * 60 * 1000 // 24 часа
   * @default undefined — без ограничения по времени
   */
  ttl?: number

  /**
   * Заголовок диалога
   * @default 'Восстановить сохранённые данные?'
   */
  dialogTitle?: string

  /**
   * Описание диалога
   * @default 'У вас есть несохранённые изменения с предыдущей сессии.'
   */
  dialogDescription?: string

  /**
   * Текст кнопки восстановления
   * @default 'Восстановить'
   */
  restoreButtonText?: string

  /**
   * Текст кнопки отмены
   * @default 'Начать заново'
   */
  discardButtonText?: string

  /**
   * Текст кнопки очистки черновика (для ClearDraftButton)
   * @default 'Очистить черновик'
   */
  clearDraftButtonText?: string
}

/**
 * Формат хранения данных в localStorage (с metadata)
 * @internal
 */
interface StoredData<TData> {
  /** Сохранённые данные формы */
  data: TData
  /** Время сохранения (timestamp) */
  savedAt: number
  /** Версия формата (для будущей миграции) */
  version: 1
}

/**
 * Результат хука useFormPersistence
 */
export interface FormPersistenceResult<TData> {
  /**
   * Есть ли сохранённые данные
   */
  hasSavedData: boolean

  /**
   * Сохранённые данные (если есть)
   */
  savedData: TData | null

  /**
   * Время сохранения черновика (timestamp)
   * Используется для отображения "Черновик от 15:30"
   */
  savedAt: number | null

  /**
   * Открыт ли диалог восстановления
   */
  isDialogOpen: boolean

  /**
   * Выбрал ли пользователь восстановление
   */
  shouldRestore: boolean

  /**
   * Сохранить текущие значения формы в localStorage
   */
  saveValues: (values: TData) => void

  /**
   * Очистить сохранённые данные из localStorage
   */
  clearSavedData: () => void

  /**
   * Принять и восстановить сохранённые данные
   */
  acceptRestore: () => TData | null

  /**
   * Отклонить восстановление и начать заново
   */
  rejectRestore: () => void

  /**
   * Закрыть диалог без действия
   */
  closeDialog: () => void

  /**
   * Отметить восстановление как завершённое (вызывается после form.reset)
   */
  markRestoreComplete: () => void

  /**
   * Компонент диалога для рендеринга
   */
  RestoreDialog: () => ReactElement | null

  /**
   * Компонент кнопки очистки черновика
   * Показывается только если есть сохранённые данные
   */
  ClearDraftButton: () => ReactElement | null
}

const STORAGE_PREFIX = 'form-persistence:'

/**
 * Хук для сохранения данных формы в localStorage
 *
 * Автоматически сохраняет состояние формы и показывает диалог
 * для восстановления сохранённых данных при загрузке формы.
 *
 * @example
 * ```tsx
 * const persistence = useFormPersistence<MyFormData>({
 *   key: 'my-form',
 *   debounceMs: 500,
 * })
 *
 * // В onSubmit формы:
 * const handleSubmit = (data) => {
 *   await saveToServer(data)
 *   persistence.clearSavedData() // Очищаем при успехе
 * }
 *
 * // Подписка на изменения формы:
 * useEffect(() => {
 *   return form.store.subscribe(() => {
 *     persistence.saveValues(form.state.values)
 *   })
 * }, [])
 * ```
 */
export function useFormPersistence<TData extends object>(config: FormPersistenceConfig): FormPersistenceResult<TData> {
  const {
    key,
    debounceMs = 500,
    ttl,
    dialogTitle = 'Restore saved data?',
    dialogDescription = 'You have unsaved changes from a previous session.',
    restoreButtonText = 'Restore',
    discardButtonText = 'Start fresh',
    clearDraftButtonText = 'Clear draft',
  } = config

  const storageKey = `${STORAGE_PREFIX}${key}`

  // Состояние
  const [savedData, setSavedData] = useState<TData | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [hasSavedData, setHasSavedData] = useState(false)
  const [shouldRestore, setShouldRestore] = useState(false)

  // Рефы для debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Загружаем сохранённые данные при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as TData | StoredData<TData>

        // Проверяем формат данных (новый с version или старый без)
        let data: TData
        let timestamp: number

        if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1) {
          // Новый формат с метаданными
          const storedData = parsed as StoredData<TData>
          data = storedData.data
          timestamp = storedData.savedAt

          // Проверяем TTL
          if (ttl !== undefined) {
            const age = Date.now() - timestamp
            if (age > ttl) {
              // Данные протухли — удаляем
              localStorage.removeItem(storageKey)
              return
            }
          }
        } else {
          // Старый формат (для обратной совместимости)
          data = parsed as TData
          timestamp = Date.now() // Не знаем точное время, ставим текущее
        }

        setSavedData(data)
        setSavedAt(timestamp)
        setHasSavedData(true)
        setIsDialogOpen(true)
      }
    } catch {
      // Невалидный JSON или ошибка localStorage — игнорируем
      localStorage.removeItem(storageKey)
    }
  }, [storageKey, ttl])

  // Сохраняем значения (с debounce)
  const saveValues = useCallback(
    (values: TData) => {
      // Не сохраняем, если ещё показываем диалог восстановления
      if (isDialogOpen) {
        return
      }

      // Очищаем предыдущий таймер
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Устанавливаем новое отложенное сохранение
      debounceTimerRef.current = setTimeout(() => {
        try {
          const now = Date.now()
          const storedData: StoredData<TData> = {
            data: values,
            savedAt: now,
            version: 1,
          }
          localStorage.setItem(storageKey, JSON.stringify(storedData))
          setSavedAt(now)
          setHasSavedData(true)
        } catch {
          // localStorage может быть заполнен или отключён
        }
      }, debounceMs)
    },
    [storageKey, debounceMs, isDialogOpen]
  )

  // Очищаем сохранённые данные
  const clearSavedData = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // Игнорируем ошибки
    }
    setSavedData(null)
    setSavedAt(null)
    setHasSavedData(false)
  }, [storageKey])

  // Принимаем восстановление
  const acceptRestore = useCallback(() => {
    setShouldRestore(true)
    setIsDialogOpen(false)
    // Сохраняем savedData, чтобы вызывающий код мог его использовать
    return savedData
  }, [savedData])

  // Отмечаем восстановление как завершённое (вызывается после form.reset)
  const markRestoreComplete = useCallback(() => {
    setShouldRestore(false)
    clearSavedData()
  }, [clearSavedData])

  // Отклоняем восстановление
  const rejectRestore = useCallback(() => {
    clearSavedData()
    setIsDialogOpen(false)
  }, [clearSavedData])

  // Закрываем диалог
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
  }, [])

  // Компонент диалога
  const RestoreDialog = useCallback((): ReactElement | null => {
    if (!hasSavedData) {
      return null
    }

    return (
      <Dialog.Root
        open={isDialogOpen}
        onOpenChange={(details) => {
          if (!details.open) {
            closeDialog()
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{dialogTitle}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>{dialogDescription}</Text>
              </Dialog.Body>
              <Dialog.Footer gap={3}>
                <Button variant="outline" onClick={rejectRestore}>
                  {discardButtonText}
                </Button>
                <Button colorPalette="blue" onClick={() => acceptRestore()}>
                  {restoreButtonText}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" onClick={rejectRestore} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    )
  }, [
    hasSavedData,
    isDialogOpen,
    dialogTitle,
    dialogDescription,
    restoreButtonText,
    discardButtonText,
    closeDialog,
    rejectRestore,
    acceptRestore,
  ])

  // Компонент кнопки очистки черновика
  const ClearDraftButton = useCallback((): ReactElement | null => {
    // Не показываем, если нет сохранённых данных или открыт диалог восстановления
    if (!hasSavedData || isDialogOpen) {
      return null
    }

    return (
      <Button variant="ghost" size="sm" colorPalette="red" onClick={clearSavedData}>
        {clearDraftButtonText}
      </Button>
    )
  }, [hasSavedData, isDialogOpen, clearSavedData, clearDraftButtonText])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    hasSavedData,
    savedData,
    savedAt,
    isDialogOpen,
    shouldRestore,
    saveValues,
    clearSavedData,
    acceptRestore,
    rejectRestore,
    closeDialog,
    markRestoreComplete,
    RestoreDialog,
    ClearDraftButton,
  }
}

/**
 * Пропсы для компонента FormWithPersistence
 */
export interface FormPersistenceProps {
  /**
   * Конфигурация сохранения
   */
  persistence?: FormPersistenceConfig
}
