'use client'

import { Badge, type BadgeProps, HStack, Icon } from '@chakra-ui/react'
import { LuWifiOff } from 'react-icons/lu'

import type { OfflineIndicatorProps } from './types'
import { useOfflineStatus } from './use-offline-status'

/**
 * Индикатор оффлайн режима
 *
 * Автоматически отображается когда браузер оффлайн.
 * Скрывается при восстановлении соединения.
 *
 * @example
 * ```tsx
 * import { Form } from '@lena/form-components'
 *
 * <Form initialValue={data} onSubmit={handleSubmit}>
 *   <Form.OfflineIndicator />
 *   <Form.Field.String name="title" />
 *   <Form.Button.Submit />
 * </Form>
 * ```
 *
 * @example С настройками
 * ```tsx
 * <Form.OfflineIndicator
 *   label="Нет связи"
 *   colorPalette="red"
 *   variant="solid"
 * />
 * ```
 */
export function FormOfflineIndicator({
  label = 'Оффлайн режим',
  colorPalette = 'orange',
  variant = 'subtle',
  ...rest
}: OfflineIndicatorProps & Omit<BadgeProps, 'children'>) {
  const isOffline = useOfflineStatus()

  if (!isOffline) {
    return null
  }

  return (
    <Badge colorPalette={colorPalette} variant={variant} data-testid="offline-indicator" {...rest}>
      <HStack gap={1}>
        <Icon asChild boxSize={3}>
          <LuWifiOff />
        </Icon>
        <span>{label}</span>
      </HStack>
    </Badge>
  )
}
