'use client'

import { Box, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { LuCoffee, LuFlaskConical, LuFolder, LuHistory, LuListVideo, LuPlay, LuSettings, LuTv } from 'react-icons/lu'

import { useFindUniqueSettings } from '@/lib/hooks'

import { ContinueWatchingCard } from './ContinueWatchingCard'
import { EncodingStatusCard } from './EncodingStatusCard'
import { WatchNextCard } from './WatchNextCard'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { href: '/library', label: 'Библиотека', icon: LuTv },
  { href: '/history', label: 'История', icon: LuHistory },
  { href: '/transcode', label: 'Очередь', icon: LuListVideo },
  { href: '/player', label: 'Плеер', icon: LuPlay },
  { href: '/test-encoding', label: 'Тест профилей', icon: LuFlaskConical },
  { href: '/settings', label: 'Настройки', icon: LuSettings },
]

/** Информация о диске */
interface DiskInfo {
  total: number
  free: number
  used: number
  usedPercent: number
}

/** Состояние блокировки сна */
interface PowerSaveState {
  isBlocking: boolean
  autoEnabled: boolean
  manualEnabled: boolean
}

/** Форматирует размер в человекочитаемый формат */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(0)} ${sizes[i]}`
}

/**
 * Боковая панель навигации
 */
export function Sidebar() {
  const pathname = usePathname()
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null)
  const [powerSave, setPowerSave] = useState<PowerSaveState | null>(null)
  const [librarySize, setLibrarySize] = useState<number | null>(null)

  // Настройки из БД (для получения пути к библиотеке)
  const { data: settings } = useFindUniqueSettings({
    where: { id: 'default' },
  })

  // Загружаем информацию о диске
  useEffect(() => {
    const loadDiskInfo = async () => {
      const api = window.electronAPI
      if (!api) {
        return
      }

      // Получаем путь к библиотеке из настроек (или userData по умолчанию)
      const info = await api.app.getDiskInfo()
      if (info) {
        setDiskInfo(info)
      }
    }

    loadDiskInfo()
    // Обновляем каждые 30 секунд
    const interval = setInterval(loadDiskInfo, 30000)
    return () => clearInterval(interval)
  }, [])

  // Загружаем размер библиотеки (с кешированием на backend)
  useEffect(() => {
    const loadLibrarySize = async () => {
      const api = window.electronAPI
      if (!api) {
        return
      }

      // Получаем путь к библиотеке
      let libraryPath = settings?.libraryPath
      if (!libraryPath) {
        // Дефолтный путь
        const videos = await api.app.getPath('videos')
        libraryPath = `${videos.replace(/\//g, '\\')}\\Animatrona`
      }

      // Получаем размер (кешируется на backend 5 минут)
      const size = await api.app.getLibrarySize(libraryPath)
      setLibrarySize(size)
    }

    loadLibrarySize()
    // Обновляем каждые 60 секунд (backend вернёт кеш если не инвалидирован)
    const interval = setInterval(loadLibrarySize, 60000)
    return () => clearInterval(interval)
  }, [settings?.libraryPath])

  // Загружаем состояние блокировки сна
  useEffect(() => {
    const loadPowerSave = async () => {
      const api = window.electronAPI
      if (!api?.app?.getPowerSaveState) {return}

      const state = await api.app.getPowerSaveState()
      setPowerSave(state)
    }

    loadPowerSave()
    // Обновляем каждые 5 секунд (состояние может меняться при старте/остановке энкода)
    const interval = setInterval(loadPowerSave, 5000)
    return () => clearInterval(interval)
  }, [])

  // Переключение ручной блокировки
  const togglePowerSave = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.app?.togglePowerSaveManual) {return}

    const result = await api.app.togglePowerSaveManual()
    setPowerSave((prev) => prev ? { ...prev, ...result } : null)
  }, [])

  return (
    <Box
      as="nav"
      data-testid="sidebar"
      w="220px"
      h="calc(100vh - 32px)"
      bg="bg.panel"
      borderRight="1px"
      borderColor="border"
      py={4}
      position="sticky"
      top={0}
      flexShrink={0}
    >
      {/* Логотип */}
      <Box px={4} mb={6}>
        <Text fontSize="xl" fontWeight="bold" color="primary.fg">
          Animatrona
        </Text>
      </Box>

      {/* Навигация */}
      <VStack gap={1} align="stretch" px={2} mb={4}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))

          return (
            <Link key={item.href} href={item.href}>
              <Box
                display="flex"
                alignItems="center"
                gap={3}
                px={3}
                py={2}
                borderRadius="md"
                bg={isActive ? 'state.selected.bg' : 'transparent'}
                color={isActive ? 'state.selected.fg' : 'fg.muted'}
                _hover={{ bg: 'state.hover', color: 'fg' }}
                _active={{ transform: 'scale(0.98)', bg: 'state.active' }}
                transition="all 0.1s ease-out"
              >
                <Icon as={item.icon} boxSize={5} />
                <Text fontSize="sm" fontWeight="medium">
                  {item.label}
                </Text>
              </Box>
            </Link>
          )
        })}
      </VStack>

      {/* Продолжить смотреть */}
      <ContinueWatchingCard />

      {/* Что смотреть дальше */}
      <WatchNextCard />

      {/* Инфо внизу */}
      <Box position="absolute" bottom={4} left={0} right={0} px={2}>
        {/* Статус кодирования */}
        <EncodingStatusCard />

        {/* Блокировка сна */}
        <Box
          as="button"
          onClick={togglePowerSave}
          p={2}
          mx={2}
          mb={2}
          borderRadius="md"
          bg={powerSave?.isBlocking ? 'yellow.900/30' : 'bg.muted'}
          border="1px"
          borderColor={powerSave?.isBlocking ? 'yellow.700/50' : 'border'}
          _hover={{ bg: powerSave?.isBlocking ? 'yellow.900/50' : 'bg.emphasized' }}
          transition="all 0.15s"
          cursor="pointer"
          w="calc(100% - 16px)"
        >
          <HStack gap={2} justify="center">
            <Icon
              as={LuCoffee}
              boxSize={4}
              color={powerSave?.isBlocking ? 'yellow.400' : 'fg.subtle'}
            />
            <Text fontSize="xs" color={powerSave?.isBlocking ? 'yellow.300' : 'fg.subtle'}>
              {powerSave?.isBlocking ? 'Не спать' : 'Сон разрешён'}
            </Text>
          </HStack>
        </Box>

        {/* Размер библиотеки и место на диске */}
        <Box p={3} mx={2} borderRadius="md" bg="bg.muted" border="1px" borderColor="border">
          {/* Размер библиотеки */}
          <HStack gap={2} mb={2}>
            <Icon as={LuFolder} boxSize={3.5} color="fg.subtle" />
            <Text fontSize="xs" color="fg.subtle">Библиотека:</Text>
            <Text fontSize="xs" color="fg" fontWeight="medium">
              {librarySize !== null ? formatBytes(librarySize) : '—'}
            </Text>
          </HStack>

          {/* Место на диске */}
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Место на диске
          </Text>
          <Box h="4px" bg="bg.emphasized" borderRadius="full" overflow="hidden">
            <Box
              w={diskInfo ? `${diskInfo.usedPercent}%` : '0%'}
              h="full"
              bg={diskInfo && diskInfo.usedPercent > 90 ? 'error.solid' : 'primary.solid'}
            />
          </Box>
          <Text fontSize="xs" color="fg.subtle" mt={1}>
            {diskInfo ? `${formatBytes(diskInfo.used)} / ${formatBytes(diskInfo.total)}` : 'Загрузка...'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
