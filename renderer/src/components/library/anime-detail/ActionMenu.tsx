'use client'

/**
 * Dropdown меню с действиями для аниме
 *
 * Заменяет вертикальный список кнопок на компактное меню
 */

import { Icon, IconButton, Menu, Portal } from '@chakra-ui/react'
import { LuDownload, LuEllipsisVertical, LuMusic, LuPencil, LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import type { WatchStatus } from '@/generated/prisma'

import { WatchStatusSubmenu } from '../WatchStatusSubmenu'

export interface ActionMenuProps {
  /** Есть ли эпизоды (для условного отображения некоторых пунктов) */
  hasEpisodes: boolean
  /** Есть ли shikimoriId (для обновления метаданных) */
  hasShikimoriId?: boolean
  /** Идёт ли загрузка метаданных */
  isRefreshingMetadata?: boolean
  /** Текущий статус просмотра */
  watchStatus?: WatchStatus
  /** Callback для редактирования */
  onEdit: () => void
  /** Callback для экспорта в MKV */
  onExport: () => void
  /** Callback для добавления дорожек */
  onAddTracks: () => void
  /** Callback для удаления */
  onDelete: () => void
  /** Callback для обновления метаданных из Shikimori */
  onRefreshMetadata?: () => void
  /** Callback для изменения статуса просмотра */
  onWatchStatusChange?: (status: WatchStatus) => void
}

export function ActionMenu({
  hasEpisodes,
  hasShikimoriId,
  isRefreshingMetadata,
  watchStatus = 'NOT_STARTED',
  onEdit,
  onExport,
  onAddTracks,
  onDelete,
  onRefreshMetadata,
  onWatchStatusChange,
}: ActionMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton variant="outline" size={{ base: 'md', md: 'lg' }} aria-label="Действия">
          <Icon as={LuEllipsisVertical} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="200px">
            {/* Подменю статуса просмотра */}
            {onWatchStatusChange && (
              <>
                <WatchStatusSubmenu
                  watchStatus={watchStatus}
                  onWatchStatusChange={onWatchStatusChange}
                />
                <Menu.Separator />
              </>
            )}

            <Menu.Item value="edit" onClick={onEdit}>
              <Icon as={LuPencil} />
              Редактировать
            </Menu.Item>

            {hasShikimoriId && onRefreshMetadata && (
              <Menu.Item value="refresh-metadata" onClick={onRefreshMetadata} disabled={isRefreshingMetadata}>
                <Icon as={LuRefreshCw} animation={isRefreshingMetadata ? 'spin 1s linear infinite' : undefined} />
                {isRefreshingMetadata ? 'Обновление...' : 'Обновить метаданные'}
              </Menu.Item>
            )}

            {hasEpisodes && (
              <>
                <Menu.Item value="export" onClick={onExport}>
                  <Icon as={LuDownload} />
                  Экспорт в MKV
                </Menu.Item>

                <Menu.Item value="add-tracks" onClick={onAddTracks}>
                  <Icon as={LuMusic} />
                  Добавить дорожки
                </Menu.Item>
              </>
            )}

            <Menu.Separator />

            <Menu.Item value="delete" color="fg.error" onClick={onDelete}>
              <Icon as={LuTrash2} />
              Удалить
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
