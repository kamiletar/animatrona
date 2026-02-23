'use client'
/* eslint-disable no-console */

/**
 * ImportQueueProcessor — координатор обработки очереди импорта (Event-driven версия)
 *
 * Принцип работы:
 * 1. Main process хранит очередь и статусы (единственный источник правды)
 * 2. Main process запускает VMAF подбор CQ автоматически
 * 3. Этот компонент слушает события от main через useImportQueue hook
 * 4. Когда main устанавливает статус 'preparing' — запускает ImportProcessor
 * 5. Статус и прогресс отправляются обратно в main через IPC
 *
 * При F5 перезагрузке:
 * - Main process сохраняет состояние (items, currentId)
 * - Renderer получает актуальное состояние через getState()
 * - Если обработка идёт — refs синхронизируются и продолжается обработка
 *
 * ВАЖНО: VMAF выполняется ТОЛЬКО в main process (ImportQueueController.runVmaf)
 * Этот компонент НЕ запускает VMAF, только отображает прогресс.
 */

import { useEffect, useRef } from 'react'

import type { ParsedFile } from '@/components/import/FileScanStep'
import { useImportFlow } from '@/lib/import'
import type { ImportOptions } from '@/lib/import/types'
import type { ImportQueueEntry } from '../../../../shared/types/import-queue'

import { useImportQueue } from '../../hooks/useImportQueue'

/**
 * Конвертирует данные из очереди в формат ImportOptions
 */
function queueEntryToImportOptions(entry: ImportQueueEntry): ImportOptions {
  const files: ParsedFile[] = entry.files.map((f) => ({
    path: f.path,
    name: f.name,
    episodeNumber: f.episodeNumber,
    selected: f.selected,
    episodeType: 'regular' as const,
    size: 0,
    extension: f.name.split('.').pop() ?? 'mkv',
    isOpEd: false,
    opEdType: undefined,
  }))

  const donorFiles: ParsedFile[] = (entry.donorFiles ?? []).map((f) => ({
    path: f.path,
    name: f.name,
    episodeNumber: f.episodeNumber,
    selected: f.selected,
    episodeType: 'regular' as const,
    size: 0,
    extension: f.name.split('.').pop() ?? 'mkv',
    isOpEd: false,
    opEdType: undefined,
  }))

  return {
    folderPath: entry.folderPath,
    parsedInfo: {
      animeName: entry.parsedInfo.animeName,
      seasonNumber: entry.parsedInfo.seasonNumber,
      subGroup: entry.parsedInfo.subGroup,
      quality: entry.parsedInfo.quality,
      original: entry.parsedInfo.original,
      source: entry.parsedInfo.source,
      isBdRemux: entry.parsedInfo.isBdRemux ?? false,
    },
    selectedAnime: {
      id: entry.selectedAnime.id,
      name: entry.selectedAnime.name,
      russian: entry.selectedAnime.russian,
      description: entry.selectedAnime.description,
      descriptionHtml: entry.selectedAnime.descriptionHtml,
      score: null,
      status: (entry.selectedAnime.status ?? 'released') as 'released' | 'ongoing' | 'anons',
      kind: entry.selectedAnime.kind as 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'music' | null,
      episodes: entry.selectedAnime.episodes ?? 0,
      episodesAired: 0,
      airedOn: entry.selectedAnime.airedOn
        ? { year: parseInt(entry.selectedAnime.airedOn.split('-')[0]), month: null, day: null }
        : null,
      releasedOn: null,
      poster: entry.selectedAnime.posterUrl
        ? { mainUrl: entry.selectedAnime.posterUrl, originalUrl: entry.selectedAnime.posterUrl }
        : null,
      genres: [],
    },
    files,
    fileAnalyses: (entry.fileAnalyses ?? []).map((fa) => ({
      file: {
        path: '',
        name: '',
        episodeNumber: fa.episodeNumber,
        selected: true,
        episodeType: 'regular' as const,
        size: 0,
        extension: 'mkv',
        isOpEd: false,
        opEdType: undefined,
      },
      mediaInfo: null,
      isAnalyzing: false,
      error: null,
      audioRecommendations: fa.audioRecommendations.map((r) => ({
        trackIndex: r.trackIndex,
        action: r.action,
        reason: '',
        enabled: r.enabled,
        isExternal: r.isExternal,
        externalPath: r.externalPath,
        groupName: r.groupName,
        language: r.language,
        dubGroup: r.dubGroup,
      })),
      subtitleRecommendations: [],
    })),
    importSettings: {
      profileId: entry.importSettings.profileId,
      audioMaxConcurrent: entry.importSettings.audioMaxConcurrent,
      videoMaxConcurrent: entry.importSettings.videoMaxConcurrent,
      cqOverride: entry.importSettings.cqOverride,
    },
    queueItemId: entry.id,
    donorPath: entry.donorPath,
    donorFiles,
    syncOffset: entry.syncOffset ?? 0,
    // CPU fallback активируется если:
    // 1. VMAF определил что нужен CPU (useCpuFallback)
    // 2. ИЛИ профиль явно указывает preferCpu
    // 3. ИЛИ GPU отключен в профиле (useGpu: false)
    // 4. ИЛИ GPU отключен глобально в Settings (globalUseGpu: false)
    // 5. ИЛИ пользователь включил forceCpu для конкретного элемента
    useCpuFallback:
      entry.vmafResult?.useCpuFallback ||
      entry.encodingProfile?.preferCpu ||
      entry.encodingProfile?.useGpu === false ||
      entry.globalUseGpu === false ||
      entry.forceCpu === true,
    vmafScore: entry.vmafResult?.vmafScore,
    isFileMode: entry.isFileMode,
  }
}

export function ImportQueueProcessor() {
  const importFlow = useImportFlow()

  // Hook для работы с очередью (события от main process)
  const { currentItem, isLoading, updateStatus, updateProgress, setImportResult } = useImportQueue()

  // Refs для отслеживания состояния и предотвращения дублирования
  const processingIdRef = useRef<string | null>(null)
  const lastStageRef = useRef<string | null>(null)
  // Время начала обработки для истории
  const importStartedAtRef = useRef<string | null>(null)

  // === DEBUG: Логирование жизненного цикла ===
  useEffect(() => {
    console.log('[ImportQueueProcessor] 🟢 MOUNTED (Event-driven version, VMAF in main)')
    return () => {
      console.log('[ImportQueueProcessor] 🔴 UNMOUNTED')
    }
  }, [])

  // === При загрузке синхронизируем refs с текущим состоянием из main ===
  useEffect(() => {
    if (isLoading) {
      return
    }

    const syncWithMain = async () => {
      const api = window.electronAPI
      if (!api) return

      // Если есть текущий обрабатываемый item — проверяем в main и синхронизируем refs
      if (currentItem) {
        if (currentItem.status === 'transcoding' || currentItem.status === 'postprocess') {
          // Проверяем в main process, действительно ли этот item обрабатывается
          const processingCheck = await api.parallelTranscode.isItemProcessing(currentItem.id)
          if (processingCheck.success && processingCheck.data) {
            // Обработка действительно идёт в main — синхронизируем ref
            if (processingIdRef.current !== currentItem.id) {
              console.log(
                `[ImportQueueProcessor] Syncing ref with main processing item ${currentItem.id} (${currentItem.status})`
              )
              processingIdRef.current = currentItem.id
            }
          }
        }
        // VMAF обрабатывается в main process — не нужно синхронизировать
      }
    }

    syncWithMain()
  }, [isLoading, currentItem])

  /**
   * Сохранить запись в историю импортов
   */
  const saveToHistory = async (
    entry: ImportQueueEntry,
    status: 'completed' | 'error' | 'cancelled',
    errorMessage?: string,
    animeId?: string
  ) => {
    const api = window.electronAPI
    if (!api) return

    const completedAt = new Date().toISOString()
    const startedAt = importStartedAtRef.current ?? completedAt
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

    const historyData = {
      queueItemId: entry.id,
      animeName: entry.selectedAnime.name,
      animeNameRu: entry.selectedAnime.russian ?? undefined,
      animeId: animeId ?? entry.selectedAnime.id,
      shikimoriId:
        typeof entry.selectedAnime.id === 'string' && entry.selectedAnime.id.match(/^\d+$/)
          ? parseInt(entry.selectedAnime.id)
          : undefined,
      posterUrl: entry.selectedAnime.posterUrl ?? undefined,
      episodesCount: entry.files.filter((f) => f.selected).length,
      seasonNumber: entry.parsedInfo.seasonNumber ?? undefined,
      status,
      errorMessage: errorMessage ?? undefined,
      startedAt,
      completedAt,
      durationMs,
      vmafScore: entry.vmafResult?.vmafScore ?? undefined,
      cqValue: entry.importSettings.cqOverride ?? entry.vmafResult?.optimalCq ?? undefined,
      usedCpuFallback: entry.vmafResult?.useCpuFallback ?? undefined,
      profileId: entry.importSettings.profileId ?? undefined,
      sourceFolderPath: entry.folderPath,
    }

    try {
      await api.history.add(historyData)
      console.log(`[ImportQueueProcessor] Saved to history: ${entry.selectedAnime.name} (${status})`)
    } catch (err) {
      console.error('[ImportQueueProcessor] Failed to save to history:', err)
    }
  }

  // === Запуск обработки когда статус 'preparing' ===
  useEffect(() => {
    const processCurrentItem = async () => {
      // Ждём загрузки начального состояния
      if (isLoading) {
        return
      }

      // Нет текущего элемента
      if (!currentItem) {
        return
      }

      // Уже обрабатываем этот элемент
      if (processingIdRef.current === currentItem.id) {
        return
      }

      // Только для статуса 'preparing'
      if (currentItem.status !== 'preparing') {
        return
      }

      const api = window.electronAPI
      if (!api) {
        await updateStatus(currentItem.id, 'error', 'Electron API недоступен')
        return
      }

      // КРИТИЧНО: Проверяем в main process, не обрабатывается ли уже этот item
      // Это защита от дублирования при F5
      const processingCheck = await api.parallelTranscode.isItemProcessing(currentItem.id)
      if (processingCheck.success && processingCheck.data) {
        console.log(`[ImportQueueProcessor] Item ${currentItem.id} already processing in main, syncing ref`)
        processingIdRef.current = currentItem.id
        return
      }

      // Пытаемся установить item как обрабатываемый (защита от race conditions)
      const setResult = await api.parallelTranscode.setProcessingItem(currentItem.id)
      if (!setResult.success || !setResult.data) {
        console.warn(`[ImportQueueProcessor] Cannot set processing item ${currentItem.id}, another item is processing`)
        return
      }

      // Запоминаем что обрабатываем
      processingIdRef.current = currentItem.id
      importStartedAtRef.current = new Date().toISOString()

      const animeName = currentItem.selectedAnime.russian || currentItem.selectedAnime.name
      console.log(`[ImportQueueProcessor] Starting import for "${animeName}"`)

      try {
        // Конвертируем данные и запускаем ImportProcessor
        const options = queueEntryToImportOptions(currentItem)
        const result = await importFlow.startImport(options)

        if (result.success) {
          await updateStatus(currentItem.id, 'completed')

          // Сохраняем результат (animeId)
          if (result.animeId) {
            await setImportResult(currentItem.id, result.animeId)
          }

          // Инвалидируем кеш размера библиотеки (для обновления в сайдбаре)
          api.app.invalidateLibrarySizeCache()

          // Системное уведомление об успехе
          api.app.showNotification({
            title: 'Импорт завершён',
            body: animeName,
            type: 'success',
          })

          // Сохраняем в историю
          await saveToHistory(currentItem, 'completed', undefined, result.animeId)
        } else {
          const errorMsg = result.error ?? 'Неизвестная ошибка'
          await updateStatus(currentItem.id, 'error', errorMsg)

          api.app.showNotification({
            title: 'Ошибка импорта',
            body: `${animeName}: ${errorMsg}`,
            type: 'error',
          })

          // Сохраняем в историю
          await saveToHistory(currentItem, 'error', errorMsg)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
        await updateStatus(currentItem.id, 'error', message)

        api.app.showNotification({
          title: 'Ошибка импорта',
          body: `${animeName}: ${message}`,
          type: 'error',
        })

        // Сохраняем в историю
        await saveToHistory(currentItem, 'error', message)
      } finally {
        processingIdRef.current = null
        // Сбрасываем processingItem в main
        api.parallelTranscode.setProcessingItem(null).catch(() => {
          // Игнорируем ошибки при сбросе
        })
      }
    }

    processCurrentItem()
  }, [isLoading, currentItem, importFlow, updateStatus, setImportResult])

  // === Обновление прогресса на основе parallelProgress ===
  // Throttling НЕ нужен здесь — useImportQueue уже батчит обновления каждые 250мс
  useEffect(() => {
    if (!currentItem || processingIdRef.current !== currentItem.id) {
      return
    }

    const parallelProgress = importFlow.parallelProgress
    if (!parallelProgress) {
      return
    }

    // Общий прогресс с полной точностью (без округления до целых)
    const newProgress = parallelProgress.totalPercent

    // Получаем VMAF результат
    const vmafResult = currentItem.vmafResult

    // Собираем данные о GPU воркерах
    const videoWorkers = parallelProgress.videoTasks.tasks
      .filter((t) => t.status === 'running')
      .map((t) => ({
        gpuIndex: t.gpuIndex ?? 0,
        fileName: t.inputPath.split(/[/\\]/).pop() ?? 'video',
        progress: t.progress?.percent ?? 0,
        fps: t.progress?.fps,
        fpsHistory: t.progress?.fpsHistory,
        speed: t.progress?.speed,
        bitrate: t.progress?.bitrate,
        cq: t.options.cq,
        vmafScore: vmafResult?.vmafScore,
        useCpuFallback: t.useCpuFallback,
        elapsedMs: t.startedAt ? Date.now() - t.startedAt : undefined,
      }))

    // Собираем данные о CPU воркерах
    const audioWorkers = parallelProgress.audioTasks.tasks
      .filter((t) => t.status === 'running' || t.status === 'completed')
      .slice(0, 8)
      .map((t) => ({
        workerId: t.id,
        name: t.title ?? `Track ${t.trackIndex}`,
        language: t.language,
        progress: t.progress?.percent ?? 0,
        status: t.status as 'pending' | 'running' | 'completed' | 'error',
      }))

    // Детальный прогресс для UI
    const detailProgress = {
      fps: importFlow.transcodeProgress?.fps,
      speed: importFlow.transcodeProgress?.speed,
      bitrate: importFlow.transcodeProgress?.bitrate,
      outputSize: importFlow.transcodeProgress?.size,
      audioTracks: importFlow.audioTracksProgress.map((t) => ({
        index: parseInt(t.trackId) || 0,
        name: t.title || t.language,
        progress: Math.round(t.percent),
      })),
      videoWorkers,
      audioWorkers,
      // Используем статистику текущего элемента (per-anime), fallback на общую
      videoTotal: parallelProgress.currentItemStats?.videoTotal ?? parallelProgress.videoTasks.total,
      videoCompleted: parallelProgress.currentItemStats?.videoCompleted ?? parallelProgress.videoTasks.completed,
      audioTotal: parallelProgress.currentItemStats?.audioTotal ?? parallelProgress.audioTasks.total,
      audioCompleted: parallelProgress.currentItemStats?.audioCompleted ?? parallelProgress.audioTasks.completed,
    }

    updateProgress(
      currentItem.id,
      newProgress,
      importFlow.currentFileName ?? undefined,
      importFlow.stage,
      detailProgress
    )
  }, [
    currentItem,
    importFlow.parallelProgress,
    importFlow.stage,
    importFlow.currentFileName,
    importFlow.transcodeProgress,
    importFlow.audioTracksProgress,
    updateProgress,
  ])

  // === Обновление статуса на основе stage ===
  useEffect(() => {
    if (!currentItem || processingIdRef.current !== currentItem.id) {
      return
    }

    const stage = importFlow.stage
    if (lastStageRef.current === stage) {
      return
    }
    lastStageRef.current = stage

    if (stage === 'transcoding_video' || stage === 'transcoding_audio') {
      if (currentItem.status !== 'transcoding') {
        updateStatus(currentItem.id, 'transcoding')
      }
    } else if (stage === 'generating_manifests' || stage === 'syncing_relations') {
      if (currentItem.status !== 'postprocess') {
        updateStatus(currentItem.id, 'postprocess')
      }
      // Обновляем currentStage в item чтобы UI показывал правильную стадию
      updateProgress(currentItem.id, currentItem.progress ?? 100, importFlow.currentFileName ?? undefined, stage)
    }
  }, [currentItem, importFlow.stage, importFlow.currentFileName, updateStatus, updateProgress])

  // Компонент не рендерит UI
  return null
}
