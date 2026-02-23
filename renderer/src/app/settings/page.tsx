'use client'

/**
 * Страница настроек приложения
 * Разделена на 5 вкладок: Библиотека, Кодирование, Просмотр, Приложение, P2P
 */

import { Box, Tabs, Text, VStack } from '@chakra-ui/react'
import { LuClapperboard, LuFolderOpen, LuPlay, LuSettings, LuShare2 } from 'react-icons/lu'

import { Header } from '@/components/layout'

import {
  EncodingProfilesCard,
  FederationCard,
  LibrarySettingsCard,
  MobileAccessCard,
  P2PSharingCard,
  PlayerSettingsCard,
  ThemeSettingsCard,
  TrackerPublishingCard,
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
            <Tabs.Trigger value="sharing">
              <LuShare2 />
              P2P
            </Tabs.Trigger>
          </Tabs.List>

          {/* Библиотека: пути к папкам */}
          <Tabs.Content value="library">
            <Box maxW="800px" py={6}>
              <LibrarySettingsCard settings={settings} defaultPaths={defaultPaths} onSave={handleSave} />
            </Box>
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

          {/* Приложение: тема + трей + мобильный доступ + обновления */}
          <Tabs.Content value="app">
            <VStack gap={6} align="stretch" maxW="800px" py={6}>
              <ThemeSettingsCard />
              <TraySettingsCard settings={settings} onSaveWithTray={handleSaveWithTray} />
              <MobileAccessCard />
              <UpdateSettingsCardNew />
            </VStack>
          </Tabs.Content>

          {/* P2P Sharing: IPFS, публикация, подписки, федерация, трекер */}
          <Tabs.Content value="sharing">
            <VStack gap={6} align="stretch" maxW="800px" py={6}>
              <P2PSharingCard />
              <TrackerPublishingCard />
              <FederationCard />
            </VStack>
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  )
}
