'use client'

/**
 * Хук для настроек кодирования в PreviewStep
 *
 * VMAF подбор CQ теперь выполняется в очереди импорта (не здесь).
 * Здесь только настраиваются параметры для очереди.
 */

import { useEffect, useMemo, useState } from 'react'

import { findManyEncodingProfiles, getDefaultEncodingProfile } from '@/app/_actions/encoding-profile.action'
import type { EncodingProfile } from '@/generated/prisma'

import type { ImportSettings } from './types'
import { getCpuCount } from './utils'

/** Целевой VMAF по умолчанию */
const DEFAULT_TARGET_VMAF = 94

interface UseEncodingSettingsOptions {
  /** Callback при изменении настроек */
  onSettingsChange?: (settings: ImportSettings) => void
}

/**
 * Хук для настроек кодирования
 */
export function useEncodingSettings(options: UseEncodingSettingsOptions) {
  const { onSettingsChange } = options

  // Профили кодирования
  const [profiles, setProfiles] = useState<EncodingProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true)

  // VMAF настройки для очереди (не выполняется тут, только настройка)
  const [vmafEnabled, setVmafEnabled] = useState(true) // По умолчанию включён
  const [targetVmaf, setTargetVmaf] = useState(DEFAULT_TARGET_VMAF)

  // Параллельные потоки
  const cpuCount = useMemo(() => getCpuCount(), [])
  const [audioMaxConcurrent, setAudioMaxConcurrent] = useState(Math.min(4, cpuCount))
  const [videoMaxConcurrent, setVideoMaxConcurrent] = useState(2) // По умолчанию 2 (Dual NVENC)

  // Загрузка профилей при монтировании
  useEffect(() => {
    async function loadProfiles() {
      try {
        const [allProfiles, defaultProfile] = await Promise.all([
          findManyEncodingProfiles({ orderBy: { name: 'asc' } }),
          getDefaultEncodingProfile(),
        ])
        setProfiles(allProfiles)
        if (defaultProfile) {
          setSelectedProfileId(defaultProfile.id)
        } else if (allProfiles.length > 0) {
          setSelectedProfileId(allProfiles[0].id)
        }
      } catch (error) {
        console.error('Ошибка загрузки профилей:', error)
      } finally {
        setIsLoadingProfiles(false)
      }
    }
    loadProfiles()
  }, [])

  // Получаем выбранный профиль (должен быть перед useEffect который его использует)
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  )

  // Уведомляем родителя об изменении настроек
  useEffect(() => {
    onSettingsChange?.({
      profileId: selectedProfileId,
      selectedProfile, // Передаём полные данные профиля для main process
      audioMaxConcurrent,
      videoMaxConcurrent,
      // VMAF настройки для очереди
      vmafEnabled,
      targetVmaf: vmafEnabled ? targetVmaf : undefined,
    })
  }, [selectedProfileId, selectedProfile, audioMaxConcurrent, videoMaxConcurrent, vmafEnabled, targetVmaf, onSettingsChange])

  return {
    // Профили
    profiles,
    selectedProfileId,
    selectedProfile,
    isLoadingProfiles,
    setSelectedProfileId,

    // VMAF настройки (для передачи в очередь)
    vmafEnabled,
    targetVmaf,
    setVmafEnabled,
    setTargetVmaf,

    // Потоки
    cpuCount,
    audioMaxConcurrent,
    videoMaxConcurrent,
    setAudioMaxConcurrent,
    setVideoMaxConcurrent,
  }
}

export type UseEncodingSettingsReturn = ReturnType<typeof useEncodingSettings>
