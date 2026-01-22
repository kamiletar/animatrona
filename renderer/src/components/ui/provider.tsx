'use client'

import { system } from '@/theme'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryProvider } from '@lena/query-provider'
import { InitProfiles } from '../init-profiles'
import { ColorModeProvider } from './color-mode'

/**
 * Провайдер Chakra UI + TanStack Query для Animatrona
 *
 * Использует кастомную систему темы с:
 * - Фирменным фиолетовым цветом (brand)
 * - Визуальной обратной связью (_active стили)
 * - Семантическими токенами для dark mode
 * - Поддержкой системной темы (по умолчанию)
 *
 * QueryProvider из @lena/query-provider с preset="standard".
 * InitProfiles инициализирует встроенные профили кодирования.
 */
export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider preset="standard">
      <ChakraProvider value={system}>
        <ColorModeProvider>
          <InitProfiles />
          {children}
        </ColorModeProvider>
      </ChakraProvider>
    </QueryProvider>
  )
}
