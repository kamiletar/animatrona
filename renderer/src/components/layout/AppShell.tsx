'use client'

import { Box, Flex } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'

import { useGlobalShortcuts } from '@/lib/shortcuts'

import { WelcomeDialog } from '../onboarding'
import { QuickSearch } from '../quick-search'
import { ShortcutsCheatsheet } from '../shortcuts'
import { PageTransition } from './PageTransition'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

interface AppShellProps {
  children: ReactNode
}

/**
 * Основной layout приложения с боковой навигацией
 *
 * Структура:
 * - Sidebar (220px) — навигация слева
 * - Content — основной контент справа
 *
 * Глобальные хоткеи:
 * - Ctrl+K или / — Quick Search (поиск аниме)
 * - Ctrl+/ — показать список горячих клавиш
 * - 1-4 — навигация по секциям
 * - Escape — закрыть простые модальные окна
 */
export function AppShell({ children }: AppShellProps) {
  const router = useRouter()
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false)

  // Закрытие простых модальных окон (не влияет на визарды и сложные диалоги)
  const closeSimpleModals = () => {
    setIsShortcutsOpen(false)
    setIsQuickSearchOpen(false)
  }

  // Обработчик открытия импорта из WelcomeDialog
  const handleOpenImport = () => {
    router.push('/library?openImport=true')
  }

  // Глобальные горячие клавиши
  useGlobalShortcuts({
    onShowShortcuts: () => setIsShortcutsOpen(true),
    onCommandPalette: () => setIsQuickSearchOpen(true), // Ctrl+K открывает Quick Search
    onImport: handleOpenImport, // Ctrl+I открывает визард импорта
    onEscape: closeSimpleModals,
  })

  return (
    <>
      {/* Кастомный title bar (frameless window) */}
      <TitleBar />

      <Flex h="100vh" pt="32px" bg="bg.canvas" overflow="hidden">
        <Sidebar />
        <Box flex={1} overflow="auto">
          <PageTransition>{children}</PageTransition>
        </Box>

        {/* Quick Search + Command Palette (Ctrl+K или /) */}
        <QuickSearch
          open={isQuickSearchOpen}
          onOpenChange={setIsQuickSearchOpen}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          onImport={handleOpenImport}
        />

        {/* Модальное окно с горячими клавишами (Ctrl+/) */}
        <ShortcutsCheatsheet open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />

        {/* Welcome Dialog при первом запуске */}
        <WelcomeDialog onOpenImport={handleOpenImport} onShowShortcuts={() => setIsShortcutsOpen(true)} />
      </Flex>
    </>
  )
}
