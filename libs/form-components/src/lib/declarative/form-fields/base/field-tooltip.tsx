'use client'

import { Box, Circle, Text, Tooltip as ChakraTooltip, Portal, VStack } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import { LuCircleHelp } from 'react-icons/lu'
import type { FieldTooltipMeta } from '../../types'

export type FieldTooltipProps = FieldTooltipMeta

/**
 * Компонент подсказки для полей формы.
 * Показывает иконку "?" с всплывающей подсказкой при наведении.
 *
 * @example
 * ```tsx
 * <FieldTooltip
 *   description="Укажите марку вашего учебного автомобиля"
 *   example="Hyundai, Kia, Volkswagen"
 *   impact="Ученики часто ищут инструктора по марке авто"
 * />
 * ```
 */
export function FieldTooltip({ title, description, example, impact }: FieldTooltipProps): ReactElement {
  return (
    <ChakraTooltip.Root openDelay={200} positioning={{ placement: 'top' }}>
      <ChakraTooltip.Trigger asChild>
        <Circle
          size="5"
          cursor="help"
          color="fg.muted"
          _hover={{ color: 'colorPalette.fg' }}
          transition="color 0.2s"
          display="inline-flex"
        >
          <LuCircleHelp size={16} />
        </Circle>
      </ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content>
            <ChakraTooltip.Arrow>
              <ChakraTooltip.ArrowTip />
            </ChakraTooltip.Arrow>
            <VStack align="start" gap={2} maxW="280px" p={1}>
              {title && (
                <Text fontWeight="semibold" fontSize="sm">
                  {title}
                </Text>
              )}
              <Text fontSize="sm">{description}</Text>
              {example && (
                <Box bg="bg.emphasized" px={2} py={1} borderRadius="md" w="full">
                  <Text fontSize="xs" color="fg.muted">
                    Пример:
                  </Text>
                  <Text fontSize="sm" fontStyle="italic">
                    &quot;{example}&quot;
                  </Text>
                </Box>
              )}
              {impact && (
                <Text fontSize="xs" color="green.fg">
                  {impact}
                </Text>
              )}
            </VStack>
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  )
}
