'use client'

/**
 * Страница настроек приложения
 * Разделена на 4 вкладки: Библиотека, Кодирование, Просмотр, Приложение
 */

import { Box, Tabs, Text, VStack } from '@chakra-ui/react'
import { LuClapperboard, LuFolderOpen, LuPlay, LuSettings } from 'react-icons/lu'

import { Header } from '@/components/layout'

import {
  EncodingProfilesCard,
  LibrarySettingsCard,
  PlayerSettingsCard,
  RestoreLibraryCard,
  ThemeSettingsCard,
  TranscodingSettingsCard,
  TraySettingsCard,
  useSettings,
} from './_settings'
import { UpdateSettingsCardNew } from './_settings/UpdateSettingsCardNew'

// Отключаем статическую генерацию для страницы настроек
export const dynamic = 'force-dynamic'

/**
 * Страница настроек приложения
 */
export default function SettingsPage() {
  const {
    // Настройки
    settings,
    isLoading,
    defaultPaths,
    handleSave,
    handleSaveWithTray,

    // Обновления
    appVersion,
    updateStatus,
    handleCheckUpdates,
    handleDownloadUpdate,
    handleInstallUpdate,

    // Профили
    profiles,
    isLoadingProfiles,
    refetchProfiles,
  } = useSettings()

  if (isLoading) {
    return (
      <Box minH="100vh" bg="bg" color="fg">
        <Header title="Настройки" />
        <Box p={6}>
          <Text color="fg.subtle">Загрузка настроек...</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg="bg" color="fg">
      <Header title="Настройки" />

      <Box p={6}>
        <Tabs.Root defaultValue="library" variant="line" lazyMount>
          <Tabs.List>
            <Tabs.Trigger value="library">
              <LuFolderOpen />
              Библиотека
            </Tabs.Trigger>
            <Tabs.Trigger value="encoding">
              <LuClapperboard />
              Кодирование
            </Tabs.Trigger>
            <Tabs.Trigger value="playback">
              <LuPlay />
              Просмотр
            </Tabs.Trigger>
            <Tabs.Trigger value="app">
              <LuSettings />
              Приложение
            </Tabs.Trigger>
          </Tabs.List>

          {/* Библиотека: пути к папкам + восстановление */}
          <Tabs.Content value="library">
            <VStack gap={6} align="stretch" maxW="800px" py={6}>
              <LibrarySettingsCard settings={settings} defaultPaths={defaultPaths} onSave={handleSave} />
              <RestoreLibraryCard settings={settings} defaultPaths={defaultPaths} />
            </VStack>
          </Tabs.Content>

          {/* Кодирование: GPU, битрейт, профили */}
          <Tabs.Content value="encoding">
            <VStack gap={6} align="stretch" maxW="800px" py={6}>
              <TranscodingSettingsCard settings={settings} onSave={handleSave} />
              <EncodingProfilesCard profiles={profiles} isLoading={isLoadingProfiles} onRefetch={refetchProfiles} />
            </VStack>
          </Tabs.Content>

          {/* Просмотр: плеер */}
          <Tabs.Content value="playback">
            <Box maxW="800px" py={6}>
              <PlayerSettingsCard settings={settings} onSave={handleSave} />
            </Box>
          </Tabs.Content>

          {/* Приложение: тема + трей + обновления */}
          <Tabs.Content value="app">
            <VStack gap={6} align="stretch" maxW="800px" py={6}>
              <ThemeSettingsCard />
              <TraySettingsCard settings={settings} onSaveWithTray={handleSaveWithTray} />
              <UpdateSettingsCardNew />
            </VStack>
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  )
}
