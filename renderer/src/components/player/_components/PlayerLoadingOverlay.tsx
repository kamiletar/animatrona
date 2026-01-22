/**
 * PlayerLoadingOverlay — оверлей загрузки видео
 */

import { Box, Text } from '@chakra-ui/react'

export interface PlayerLoadingOverlayProps {
  /** Показывать оверлей */
  isLoading: boolean
}

/**
 * Компонент оверлея загрузки
 */
export function PlayerLoadingOverlay({ isLoading }: PlayerLoadingOverlayProps) {
  if (!isLoading) {
    return null
  }

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.700"
    >
      <Text color="white">Загрузка...</Text>
    </Box>
  )
}
