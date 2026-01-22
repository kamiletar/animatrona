'use client'

/**
 * Кнопка автоподбора CQ с интеграцией в форму
 *
 * Должна использоваться внутри AnimatronaForm для доступа к контексту формы.
 */

import { Button, Icon } from '@chakra-ui/react'
import { useState } from 'react'
import { LuTarget } from 'react-icons/lu'

import { useDeclarativeForm } from '@lena/form-components'

import { toaster } from '@/components/ui/toaster'
import type { CqSearchResult } from '../../../../shared/types/vmaf'
import type { VideoTranscodeOptions } from '../../../../shared/types'
import { VmafAutoDialog } from './VmafAutoDialog'

interface VmafCqButtonProps {
  /** Отключено */
  disabled?: boolean
  /** Размер кнопки */
  size?: 'xs' | 'sm' | 'md'
}

/**
 * Кнопка автоподбора CQ через VMAF
 *
 * При нахождении оптимального CQ автоматически обновляет поле формы.
 */
export function VmafCqButton({ disabled, size = 'sm' }: VmafCqButtonProps) {
  const { form } = useDeclarativeForm()
  const [dialogOpen, setDialogOpen] = useState(false)

  /**
   * Обработчик успешного нахождения CQ
   */
  const handleOptimalCqFound = (result: CqSearchResult) => {
    // Обновляем поле CQ в форме
    form.setFieldValue('cq', result.optimalCq)

    // Уведомляем пользователя
    toaster.success({
      title: `CQ установлен: ${result.optimalCq}`,
      description: `VMAF ${result.vmafScore.toFixed(1)}, экономия ${(result.estimatedSavings * 100).toFixed(0)}%`,
    })
  }

  /**
   * Получаем текущие настройки кодирования из формы
   */
  const getVideoOptions = (): Omit<VideoTranscodeOptions, 'cq'> => {
    const codec = (form.getFieldValue('codec') as string) || 'av1'
    const useGpu = (form.getFieldValue('useGpu') as boolean) ?? true
    const preset = (form.getFieldValue('preset') as string) || 'p4'

    return {
      codec: codec as VideoTranscodeOptions['codec'],
      useGpu,
      preset: preset as VideoTranscodeOptions['preset'],
    }
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        colorPalette="purple"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
      >
        <Icon as={LuTarget} mr={1} />
        Авто VMAF
      </Button>

      <VmafAutoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        videoOptions={getVideoOptions()}
        onOptimalCqFound={handleOptimalCqFound}
      />
    </>
  )
}
