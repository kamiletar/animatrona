'use client'

import { Badge, type BadgeProps, HStack, Icon, Spinner } from '@chakra-ui/react'
import { LuCheck, LuClock } from 'react-icons/lu'

import type { SyncStatusProps } from './types'
import { useOfflineStatus } from './use-offline-status'
import { useSyncQueue } from './use-sync-queue'

/**
 * Индикатор статуса синхронизации очереди
 *
 * Показывает:
 * - Количество ожидающих действий
 * - Spinner при синхронизации
 * - "Синхронизировано" когда очередь пуста
 *
 * Работает глобально, не требует Form контекста.
 *
 * @example
 * ```tsx
 * import { FormSyncStatus } from '@lena/form-components/offline'
 *
 * // В layout или header
 * <FormSyncStatus />
 * ```
 *
 * @example С настройками
 * ```tsx
 * <FormSyncStatus
 *   showWhenEmpty={false}
 *   syncingLabel="Синхронизация..."
 *   pendingLabel={(count) => `Ожидает: ${count}`}
 *   syncedLabel="Всё синхронизировано"
 * />
 * ```
 */
export function FormSyncStatus({
  showWhenEmpty = false,
  syncingLabel = 'Синхронизация...',
  pendingLabel = (count: number) => `Ожидает: ${count}`,
  syncedLabel = 'Синхронизировано',
  colorPalette = 'blue',
  ...rest
}: SyncStatusProps & Omit<BadgeProps, 'children'>) {
  const isOffline = useOfflineStatus()
  const { pendingCount, isProcessing } = useSyncQueue()

  // Скрываем если онлайн, очередь пуста и showWhenEmpty = false
  if (!isOffline && pendingCount === 0 && !isProcessing && !showWhenEmpty) {
    return null
  }

  // Определяем что показывать
  const renderContent = () => {
    // Синхронизация в процессе
    if (isProcessing) {
      return (
        <HStack gap={1}>
          <Spinner size="xs" />
          <span>{syncingLabel}</span>
        </HStack>
      )
    }

    // Есть ожидающие элементы
    if (pendingCount > 0) {
      const label = typeof pendingLabel === 'function' ? pendingLabel(pendingCount) : pendingLabel
      return (
        <HStack gap={1}>
          <Icon asChild boxSize={3}>
            <LuClock />
          </Icon>
          <span>{label}</span>
        </HStack>
      )
    }

    // Всё синхронизировано
    return (
      <HStack gap={1}>
        <Icon asChild boxSize={3}>
          <LuCheck />
        </Icon>
        <span>{syncedLabel}</span>
      </HStack>
    )
  }

  // Цвет зависит от состояния
  const effectiveColorPalette = pendingCount > 0 ? 'orange' : isProcessing ? colorPalette : 'green'

  return (
    <Badge
      colorPalette={effectiveColorPalette}
      variant="subtle"
      data-testid="sync-status"
      data-pending-count={pendingCount}
      data-processing={isProcessing}
      {...rest}
    >
      {renderContent()}
    </Badge>
  )
}
