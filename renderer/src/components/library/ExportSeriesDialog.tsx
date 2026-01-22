'use client'

import {
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  Icon,
  Portal,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { DragEndEvent } from '@dnd-kit/core'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuCheck, LuCircleAlert, LuDownload, LuFolderOpen, LuGripVertical, LuPlay, LuStar, LuX } from 'react-icons/lu'

import { getRecommendedPattern, NAMING_PATTERNS } from '@/animatrona-form'
import { getFranchiseGraphFromDb } from '@/app/_actions/franchise.action'
import { toaster } from '@/components/ui/toaster'
import type { AudioTrack, Chapter, Episode, Season, SubtitleFont, SubtitleTrack } from '@/generated/prisma'
import { getFranchiseSeasonNumber } from '@/lib/franchise'
import type { EpisodeExportData, ExportSeriesConfig, NamingPattern } from '@/types/electron'
import type { ExportResult, SeasonType, SeriesExportProgress } from '../../../../shared/types/export'

/** Тип SubtitleTrack с шрифтами */
type SubtitleTrackWithFonts = SubtitleTrack & {
  fonts: SubtitleFont[]
}

/** Тип Episode с дорожками и главами */
type EpisodeWithTracks = Episode & {
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrackWithFonts[]
  chapters: Chapter[]
  season: Season
}

interface ExportSeriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anime: {
    id: string
    name: string
    year?: number | null
    posterPath?: string | null
    episodes: EpisodeWithTracks[]
    /** Франшиза (для структуры папок) */
    franchise?: string | null
    /** Тип сезона (для автовыбора паттерна) */
    seasonType?: SeasonType | null
    /** Shikimori ID для определения порядка во франшизе */
    shikimoriId?: number | null
    /** ID франшизы для загрузки графа */
    franchiseId?: string | null
  }
  /** Папка экспорта по умолчанию из настроек */
  defaultExportPath?: string
}

/** Шаг диалога */
type DialogStep = 'config' | 'progress' | 'done'

/** Информация о дорожке для UI */
interface TrackInfo {
  key: string
  language: string
  title: string
  codec?: string
  channels?: string
  format?: string
  episodeCount: number
  allReady: boolean
}

/**
 * Генерирует ключ для группировки дорожек
 */
function getTrackKey(language: string, title: string | null): string {
  return `${language}:${title || 'default'}`
}

/**
 * Собирает уникальные аудиодорожки из всех эпизодов
 */
function collectAudioTracks(episodes: EpisodeWithTracks[]): TrackInfo[] {
  const trackMap = new Map<string, TrackInfo>()

  for (const episode of episodes) {
    for (const track of episode.audioTracks) {
      const key = getTrackKey(track.language, track.title)

      const existing = trackMap.get(key)
      if (existing) {
        existing.episodeCount++
        // Проверяем, все ли дорожки готовы
        if (track.transcodeStatus !== 'COMPLETED' && track.transcodeStatus !== 'SKIPPED') {
          existing.allReady = false
        }
      } else {
        trackMap.set(key, {
          key,
          language: track.language,
          title: track.title || 'default',
          codec: track.codec,
          channels: track.channels,
          episodeCount: 1,
          allReady: track.transcodeStatus === 'COMPLETED' || track.transcodeStatus === 'SKIPPED',
        })
      }
    }
  }

  return Array.from(trackMap.values()).sort((a, b) => {
    if (a.language !== b.language) {
      return a.language.localeCompare(b.language)
    }
    return a.title.localeCompare(b.title)
  })
}

/**
 * Собирает уникальные субтитры из всех эпизодов
 */
function collectSubtitleTracks(episodes: EpisodeWithTracks[]): TrackInfo[] {
  const trackMap = new Map<string, TrackInfo>()

  for (const episode of episodes) {
    for (const track of episode.subtitleTracks) {
      const key = getTrackKey(track.language, track.title)

      const existingSubtitle = trackMap.get(key)
      if (existingSubtitle) {
        existingSubtitle.episodeCount++
        if (!track.filePath) {
          existingSubtitle.allReady = false
        }
      } else {
        trackMap.set(key, {
          key,
          language: track.language,
          title: track.title || 'default',
          format: track.format,
          episodeCount: 1,
          allReady: !!track.filePath,
        })
      }
    }
  }

  return Array.from(trackMap.values()).sort((a, b) => {
    if (a.language !== b.language) {
      return a.language.localeCompare(b.language)
    }
    return a.title.localeCompare(b.title)
  })
}

/**
 * Props для SortableTrackItem
 */
interface SortableTrackItemProps {
  track: TrackInfo
  isDefault: boolean
  onSetDefault: () => void
  colorPalette: 'blue' | 'purple'
  showDefaultButton: boolean
}

/**
 * Sortable item для drag-and-drop дорожек
 */
function SortableTrackItem({
  track,
  isDefault,
  onSetDefault,
  colorPalette,
  showDefaultButton,
}: SortableTrackItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      align="center"
      gap={2}
      p={2}
      bg={isDefault ? `${colorPalette}.900` : 'bg.subtle'}
      borderRadius="md"
      borderWidth={isDefault ? '1px' : '0'}
      borderColor={isDefault ? `${colorPalette}.500` : 'transparent'}
    >
      {/* Drag handle */}
      <Box {...attributes} {...listeners} cursor="grab" color="fg.subtle" _hover={{ color: 'fg.muted' }}>
        <Icon as={LuGripVertical} />
      </Box>

      {/* Track info */}
      <HStack flex={1} gap={2}>
        <Badge colorPalette={colorPalette} size="sm">
          {track.language}
        </Badge>
        <Text fontSize="sm">{track.title}</Text>
        {track.codec && (
          <Text color="fg.subtle" fontSize="xs">
            ({track.codec})
          </Text>
        )}
        {track.format && (
          <Text color="fg.subtle" fontSize="xs">
            ({track.format})
          </Text>
        )}
        <Text color="fg.subtle" fontSize="xs">
          · {track.episodeCount} эп.
        </Text>
      </HStack>

      {/* Default button */}
      {showDefaultButton && (
        <Button
          size="xs"
          variant={isDefault ? 'solid' : 'ghost'}
          colorPalette={isDefault ? colorPalette : 'gray'}
          onClick={onSetDefault}
          title={isDefault ? 'Дорожка по умолчанию' : 'Сделать дорожкой по умолчанию'}
        >
          <Icon as={LuStar} />
        </Button>
      )}
    </Flex>
  )
}

/**
 * Диалог экспорта сериала в MKV
 */
export function ExportSeriesDialog({ open, onOpenChange, anime, defaultExportPath }: ExportSeriesDialogProps) {
  const [step, setStep] = useState<DialogStep>('config')
  const [progress, setProgress] = useState<SeriesExportProgress | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Форма — состояние чекбоксов и настроек
  const [selectedAudioKeys, setSelectedAudioKeys] = useState<string[]>([])
  const [selectedSubtitleKeys, setSelectedSubtitleKeys] = useState<string[]>([])
  const [selectedEpisodeNumbers, setSelectedEpisodeNumbers] = useState<Set<number>>(new Set())
  const [outputDir, setOutputDir] = useState('')
  // Определяем default паттерн на основе типа сезона
  const defaultPattern = useMemo(() => {
    if (anime.seasonType) {
      return getRecommendedPattern(anime.seasonType)
    }
    return '{Year} - {Anime} - S{ss}E{nn}'
  }, [anime.seasonType])
  const [namingPattern, setNamingPattern] = useState<NamingPattern>(defaultPattern)
  // Default tracks — ключи дорожек по умолчанию
  const [defaultAudioKey, setDefaultAudioKey] = useState<string | null>(null)
  const [defaultSubtitleKey, setDefaultSubtitleKey] = useState<string | null>(null)
  // Новые опции
  const [createFolderStructure, setCreateFolderStructure] = useState(true)
  const [openFolderAfterExport, setOpenFolderAfterExport] = useState(true)
  // Номер сезона из графа франшизы (1 если нет франшизы)
  const [franchiseSeasonNumber, setFranchiseSeasonNumber] = useState<number>(1)

  // Загрузка графа франшизы для определения номера сезона
  useEffect(() => {
    async function loadFranchiseOrder() {
      if (!anime.franchiseId || !anime.shikimoriId) {
        setFranchiseSeasonNumber(1)
        return
      }

      try {
        const graph = await getFranchiseGraphFromDb(anime.franchiseId)
        const seasonNum = getFranchiseSeasonNumber(graph, anime.shikimoriId)
        setFranchiseSeasonNumber(seasonNum)
      } catch {
        setFranchiseSeasonNumber(1)
      }
    }

    if (open) {
      loadFranchiseOrder()
    }
  }, [open, anime.franchiseId, anime.shikimoriId])

  // Preview имени файла и структуры папок
  const previewInfo = useMemo(() => {
    const year = anime.year || new Date().getFullYear()
    const seasonStr = String(franchiseSeasonNumber).padStart(2, '0')
    const sampleFileName =
      namingPattern
        .replace('{Anime}', anime.name)
        .replace('{Year}', String(year))
        .replace('{nn}', '01')
        .replace('{ss}', seasonStr)
        .replace('{Episode}', 'Episode 1') + '.mkv'

    let folderPath = ''
    if (createFolderStructure) {
      if (anime.franchise) {
        folderPath = `${anime.franchise}/${year} - ${anime.name}/`
      } else {
        folderPath = `${year} - ${anime.name}/`
      }
    }

    return { sampleFileName, folderPath }
  }, [namingPattern, anime.name, anime.year, anime.franchise, createFolderStructure, franchiseSeasonNumber])

  // Sensors для drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Собираем доступные дорожки
  const audioTracks = useMemo(() => collectAudioTracks(anime.episodes), [anime.episodes])
  const subtitleTracks = useMemo(() => collectSubtitleTracks(anime.episodes), [anime.episodes])

  // Готовые эпизоды (есть хотя бы одна готовая аудиодорожка + видео)
  const readyEpisodesList = useMemo(() => {
    return anime.episodes
      .filter(
        (ep) =>
          ep.audioTracks.some((t) => t.transcodeStatus === 'COMPLETED' || t.transcodeStatus === 'SKIPPED') &&
          (ep.transcodedPath || ep.sourcePath)
      )
      .sort((a, b) => a.number - b.number)
  }, [anime.episodes])

  const readyEpisodes = readyEpisodesList.length

  // Подписка на события экспорта
  useEffect(() => {
    if (!window.electronAPI?.export) {
      return
    }

    const unsubProgress = window.electronAPI.export.onProgress((p) => {
      setProgress(p)
    })

    const unsubCompleted = window.electronAPI.export.onCompleted((r) => {
      setResult(r)
      setStep('done')
      setIsExporting(false)
    })

    const unsubError = window.electronAPI.export.onError((error) => {
      toaster.error({
        title: 'Ошибка экспорта',
        description: error,
      })
      setIsExporting(false)
      setStep('config')
    })

    return () => {
      unsubProgress()
      unsubCompleted()
      unsubError()
    }
  }, [])

  // Сброс состояния при открытии
  useEffect(() => {
    if (open) {
      setStep('config')
      setProgress(null)
      setResult(null)
      setIsExporting(false)
      // Выбираем первую аудиодорожку по умолчанию
      if (audioTracks.length > 0 && selectedAudioKeys.length === 0) {
        setSelectedAudioKeys([audioTracks[0].key])
        setDefaultAudioKey(audioTracks[0].key)
      }
      // Сбрасываем default subtitle
      setDefaultSubtitleKey(null)
      // Выбираем все готовые эпизоды по умолчанию
      setSelectedEpisodeNumbers(new Set(readyEpisodesList.map((ep) => ep.number)))
      // Устанавливаем папку экспорта по умолчанию
      if (defaultExportPath && !outputDir) {
        setOutputDir(defaultExportPath)
      }
      // Устанавливаем паттерн по умолчанию
      setNamingPattern(defaultPattern)
    }
  }, [open, audioTracks, readyEpisodesList, defaultExportPath, defaultPattern])

  /**
   * Подготавливает данные эпизодов для экспорта
   */
  const prepareEpisodeData = useCallback((): EpisodeExportData[] => {
    return anime.episodes
      .filter((ep) => selectedEpisodeNumbers.has(ep.number)) // Фильтр по выбранным эпизодам
      .filter((ep) => {
        // Фильтруем эпизоды — должна быть хотя бы одна выбранная готовая аудиодорожка
        return ep.audioTracks.some((t) => {
          const key = getTrackKey(t.language, t.title)
          return (
            selectedAudioKeys.includes(key) && (t.transcodeStatus === 'COMPLETED' || t.transcodeStatus === 'SKIPPED')
          )
        })
      })
      .filter((ep) => ep.transcodedPath || ep.sourcePath) // Должно быть видео
      .map((ep) => {
        // Аудиодорожки
        const audioTracksData = ep.audioTracks
          .filter((t) => {
            const key = getTrackKey(t.language, t.title)
            return (
              selectedAudioKeys.includes(key) && (t.transcodeStatus === 'COMPLETED' || t.transcodeStatus === 'SKIPPED')
            )
          })
          .map((t) => ({
            language: t.language,
            title: t.title,
            transcodedPath: t.transcodedPath,
            streamIndex: t.streamIndex,
            inputPath: t.transcodedPath || ep.sourcePath || '',
          }))

        // Субтитры
        const subtitleTracksData = ep.subtitleTracks
          .filter((t) => {
            const key = getTrackKey(t.language, t.title)
            return selectedSubtitleKeys.includes(key) && t.filePath
          })
          .map((t) => ({
            language: t.language,
            title: t.title,
            filePath: t.filePath,
            fonts: t.fonts.map((f) => f.filePath),
          }))

        // Главы
        const chapters = ep.chapters.map((c) => ({
          startMs: c.startMs,
          endMs: c.endMs,
          title: c.title,
          type: c.type,
        }))

        return {
          id: ep.id,
          number: ep.number,
          // Используем номер сезона из графа франшизы (не внутренний ep.season.number)
          seasonNumber: franchiseSeasonNumber,
          name: ep.name,
          videoPath: ep.transcodedPath || ep.sourcePath || '',
          audioTracks: audioTracksData,
          subtitleTracks: subtitleTracksData,
          chapters,
        }
      })
  }, [anime.episodes, selectedAudioKeys, selectedSubtitleKeys, selectedEpisodeNumbers, franchiseSeasonNumber])

  /**
   * Запуск экспорта
   */
  const handleStartExport = async () => {
    // Валидация
    if (selectedEpisodeNumbers.size === 0) {
      toaster.error({ title: 'Выберите хотя бы один эпизод' })
      return
    }

    if (selectedAudioKeys.length === 0) {
      toaster.error({ title: 'Выберите хотя бы одну аудиодорожку' })
      return
    }

    if (!outputDir) {
      toaster.error({ title: 'Выберите папку для экспорта' })
      return
    }

    if (!window.electronAPI?.export) {
      toaster.error({ title: 'Electron API недоступен' })
      return
    }

    const episodesData = prepareEpisodeData()

    if (episodesData.length === 0) {
      toaster.error({
        title: 'Нет эпизодов для экспорта',
        description: 'Убедитесь, что выбранные дорожки доступны',
      })
      return
    }

    // Вычисляем индексы default tracks по позиции в массиве
    const defaultAudioIndex = defaultAudioKey ? selectedAudioKeys.indexOf(defaultAudioKey) : 0
    const defaultSubtitleIndex = defaultSubtitleKey ? selectedSubtitleKeys.indexOf(defaultSubtitleKey) : undefined

    const config: ExportSeriesConfig = {
      animeName: anime.name,
      year: anime.year ?? undefined,
      outputDir,
      namingPattern,
      posterPath: anime.posterPath ?? undefined,
      episodes: episodesData,
      selectedAudioKeys,
      selectedSubtitleKeys,
      defaultAudioIndex: defaultAudioIndex >= 0 ? defaultAudioIndex : 0,
      defaultSubtitleIndex:
        defaultSubtitleIndex !== undefined && defaultSubtitleIndex >= 0 ? defaultSubtitleIndex : undefined,
      // Новые опции
      franchise: anime.franchise ?? undefined,
      seasonType: anime.seasonType ?? undefined,
      createFolderStructure,
      openFolderAfterExport,
    }

    setIsExporting(true)
    setStep('progress')
    setProgress({
      totalEpisodes: episodesData.length,
      completedEpisodes: 0,
      currentEpisodeIndex: 0,
      episodes: episodesData.map((ep) => ({
        episodeId: ep.id,
        episodeNumber: ep.number,
        seasonNumber: ep.seasonNumber,
        status: 'pending',
        percent: 0,
      })),
      status: 'processing',
    })

    try {
      await window.electronAPI.export.start(config)
    } catch (error) {
      toaster.error({
        title: 'Ошибка запуска экспорта',
        description: String(error),
      })
      setIsExporting(false)
      setStep('config')
    }
  }

  /**
   * Отмена экспорта
   */
  const handleCancel = async () => {
    if (!window.electronAPI?.export) {
      return
    }

    try {
      await window.electronAPI.export.cancel()
      toaster.info({ title: 'Экспорт отменён' })
      setIsExporting(false)
      setStep('config')
    } catch (error) {
      toaster.error({
        title: 'Ошибка отмены',
        description: String(error),
      })
    }
  }

  /**
   * Выбор папки через Electron dialog
   */
  const handleSelectFolder = async () => {
    if (!window.electronAPI?.dialog) {
      return
    }

    const folder = await window.electronAPI.dialog.selectFolder()
    if (folder) {
      setOutputDir(folder)
    }
  }

  /**
   * Переключение чекбокса аудиодорожки
   */
  const toggleAudioTrack = (key: string) => {
    setSelectedAudioKeys((prev) => {
      if (prev.includes(key)) {
        // При снятии выбора — если это была default, сбрасываем
        if (defaultAudioKey === key) {
          const newKeys = prev.filter((k) => k !== key)
          setDefaultAudioKey(newKeys[0] || null)
        }
        return prev.filter((k) => k !== key)
      } else {
        // При добавлении — если это первая дорожка, делаем её default
        if (prev.length === 0) {
          setDefaultAudioKey(key)
        }
        return [...prev, key]
      }
    })
  }

  /**
   * Переключение чекбокса субтитров
   */
  const toggleSubtitleTrack = (key: string) => {
    setSelectedSubtitleKeys((prev) => {
      if (prev.includes(key)) {
        // При снятии выбора — если это была default, сбрасываем
        if (defaultSubtitleKey === key) {
          const newKeys = prev.filter((k) => k !== key)
          setDefaultSubtitleKey(newKeys.length > 0 ? newKeys[0] : null)
        }
        return prev.filter((k) => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  /**
   * Drag-and-drop для аудиодорожек
   */
  const handleAudioDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSelectedAudioKeys((prev) => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  /**
   * Drag-and-drop для субтитров
   */
  const handleSubtitleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSelectedSubtitleKeys((prev) => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  /**
   * Переключение выбора эпизода
   */
  const toggleEpisode = (num: number) => {
    setSelectedEpisodeNumbers((prev) => {
      const next = new Set(prev)
      if (next.has(num)) {
        next.delete(num)
      } else {
        next.add(num)
      }
      return next
    })
  }

  /**
   * Выбрать все готовые эпизоды
   */
  const selectAllEpisodes = () => {
    setSelectedEpisodeNumbers(new Set(readyEpisodesList.map((ep) => ep.number)))
  }

  /**
   * Снять выбор со всех эпизодов
   */
  const deselectAllEpisodes = () => {
    setSelectedEpisodeNumbers(new Set())
  }

  // Рендер шага конфигурации
  const renderConfigStep = () => (
    <>
      <Dialog.Body>
        <VStack gap={4} align="stretch">
          {/* Информация об аниме */}
          <Box p={4} bg="bg.subtle" borderRadius="md">
            <Text fontWeight="bold" fontSize="lg">
              {anime.name}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {readyEpisodes} из {anime.episodes.length} эпизодов готовы к экспорту
            </Text>
          </Box>

          {/* Предупреждение если не все эпизоды готовы */}
          {readyEpisodes < anime.episodes.length && (
            <Box p={3} bg="yellow.subtle" borderRadius="md">
              <HStack>
                <Icon as={LuCircleAlert} color="yellow.fg" />
                <Text color="yellow.fg" fontSize="sm">
                  Некоторые эпизоды не имеют готовых дорожек и будут пропущены
                </Text>
              </HStack>
            </Box>
          )}

          {/* Выбор эпизодов */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="medium">
                Эпизоды ({selectedEpisodeNumbers.size} из {readyEpisodes}) *
              </Text>
              <HStack gap={1}>
                <Button size="xs" variant="ghost" onClick={selectAllEpisodes}>
                  Все
                </Button>
                <Button size="xs" variant="ghost" onClick={deselectAllEpisodes}>
                  Ни одного
                </Button>
              </HStack>
            </HStack>
            <Box maxH="120px" overflowY="auto" p={2} bg="bg.subtle" borderRadius="md">
              <Flex gap={2} wrap="wrap">
                {readyEpisodesList.map((ep) => (
                  <Checkbox.Root
                    key={ep.id}
                    size="sm"
                    checked={selectedEpisodeNumbers.has(ep.number)}
                    onCheckedChange={() => toggleEpisode(ep.number)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      <Text fontSize="sm">{ep.number}</Text>
                    </Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </Flex>
            </Box>
          </Box>

          {/* Выбор аудиодорожек */}
          <Box>
            <Text fontWeight="medium" mb={2}>
              Аудиодорожки * {selectedAudioKeys.length > 0 && `(${selectedAudioKeys.length} выбрано)`}
            </Text>
            <VStack align="stretch" gap={1}>
              {audioTracks.map((track) => (
                <Checkbox.Root
                  key={track.key}
                  checked={selectedAudioKeys.includes(track.key)}
                  onCheckedChange={() => toggleAudioTrack(track.key)}
                  disabled={!track.allReady}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <HStack gap={2}>
                      <Badge colorPalette="blue" size="sm">
                        {track.language}
                      </Badge>
                      <Text>{track.title}</Text>
                      {track.codec && (
                        <Text color="fg.subtle" fontSize="xs">
                          ({track.codec})
                        </Text>
                      )}
                      <Text color="fg.subtle" fontSize="xs">
                        · {track.episodeCount} эп.
                      </Text>
                      {!track.allReady && (
                        <Badge colorPalette="yellow" size="sm">
                          Не все готовы
                        </Badge>
                      )}
                    </HStack>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
              {audioTracks.length === 0 && (
                <Text color="fg.subtle" fontSize="sm">
                  Нет доступных аудиодорожек
                </Text>
              )}
            </VStack>
          </Box>

          {/* Порядок аудиодорожек (drag-and-drop) */}
          {selectedAudioKeys.length > 1 && (
            <Box>
              <Text fontWeight="medium" mb={1}>
                Порядок аудиодорожек
              </Text>
              <Text color="fg.subtle" fontSize="xs" mb={2}>
                Перетащите для изменения порядка. ★ = дорожка по умолчанию в плеере.
              </Text>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAudioDragEnd}>
                <SortableContext items={selectedAudioKeys} strategy={verticalListSortingStrategy}>
                  <VStack align="stretch" gap={1}>
                    {selectedAudioKeys.map((key) => {
                      const track = audioTracks.find((t) => t.key === key)
                      if (!track) {
                        return null
                      }
                      return (
                        <SortableTrackItem
                          key={key}
                          track={track}
                          isDefault={defaultAudioKey === key}
                          onSetDefault={() => setDefaultAudioKey(key)}
                          colorPalette="blue"
                          showDefaultButton={selectedAudioKeys.length > 1}
                        />
                      )
                    })}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}

          {/* Выбор субтитров */}
          <Box>
            <Text fontWeight="medium" mb={2}>
              Субтитры (опционально) {selectedSubtitleKeys.length > 0 && `(${selectedSubtitleKeys.length} выбрано)`}
            </Text>
            <VStack align="stretch" gap={1}>
              {subtitleTracks.map((track) => (
                <Checkbox.Root
                  key={track.key}
                  checked={selectedSubtitleKeys.includes(track.key)}
                  onCheckedChange={() => toggleSubtitleTrack(track.key)}
                  disabled={!track.allReady}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <HStack gap={2}>
                      <Badge colorPalette="purple" size="sm">
                        {track.language}
                      </Badge>
                      <Text>{track.title}</Text>
                      {track.format && (
                        <Text color="fg.subtle" fontSize="xs">
                          ({track.format})
                        </Text>
                      )}
                      <Text color="fg.subtle" fontSize="xs">
                        · {track.episodeCount} эп.
                      </Text>
                      {!track.allReady && (
                        <Badge colorPalette="yellow" size="sm">
                          Не все готовы
                        </Badge>
                      )}
                    </HStack>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
              {subtitleTracks.length === 0 && (
                <Text color="fg.subtle" fontSize="sm">
                  Нет доступных субтитров
                </Text>
              )}
            </VStack>
          </Box>

          {/* Порядок субтитров (drag-and-drop) */}
          {selectedSubtitleKeys.length > 1 && (
            <Box>
              <Text fontWeight="medium" mb={1}>
                Порядок субтитров
              </Text>
              <Text color="fg.subtle" fontSize="xs" mb={2}>
                Перетащите для изменения порядка. ★ = субтитры по умолчанию (авто-включатся в плеере).
              </Text>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubtitleDragEnd}>
                <SortableContext items={selectedSubtitleKeys} strategy={verticalListSortingStrategy}>
                  <VStack align="stretch" gap={1}>
                    {selectedSubtitleKeys.map((key) => {
                      const track = subtitleTracks.find((t) => t.key === key)
                      if (!track) {
                        return null
                      }
                      return (
                        <SortableTrackItem
                          key={key}
                          track={track}
                          isDefault={defaultSubtitleKey === key}
                          onSetDefault={() => setDefaultSubtitleKey(defaultSubtitleKey === key ? null : key)}
                          colorPalette="purple"
                          showDefaultButton
                        />
                      )
                    })}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}

          {/* Папка назначения */}
          <Box>
            <Text fontWeight="medium" mb={2}>
              Папка назначения *
            </Text>
            <HStack>
              <Box flex={1} p={2} bg="bg.subtle" borderRadius="md" minH="40px" display="flex" alignItems="center">
                <Text color={outputDir ? 'white' : 'fg.subtle'} fontSize="sm" truncate>
                  {outputDir || 'Выберите папку...'}
                </Text>
              </Box>
              <Button variant="outline" onClick={handleSelectFolder}>
                <Icon as={LuFolderOpen} mr={2} />
                Обзор
              </Button>
            </HStack>
          </Box>

          {/* Паттерн именования */}
          <Box>
            <Text fontWeight="medium" mb={2}>
              Паттерн именования
            </Text>
            <VStack align="stretch" gap={1}>
              {NAMING_PATTERNS.map((pattern) => (
                <Checkbox.Root
                  key={pattern.value}
                  checked={namingPattern === pattern.value}
                  onCheckedChange={() => setNamingPattern(pattern.value)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control borderRadius="full" />
                  <Checkbox.Label>
                    <Text>{pattern.label}</Text>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
            </VStack>
          </Box>

          {/* Опции экспорта */}
          <Box>
            <Text fontWeight="medium" mb={2}>
              Опции
            </Text>
            <VStack align="stretch" gap={2}>
              <Checkbox.Root
                checked={createFolderStructure}
                onCheckedChange={(e) => setCreateFolderStructure(!!e.checked)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>
                  <Text>Создать структуру папок</Text>
                </Checkbox.Label>
              </Checkbox.Root>
              <Checkbox.Root
                checked={openFolderAfterExport}
                onCheckedChange={(e) => setOpenFolderAfterExport(!!e.checked)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>
                  <Text>Открыть папку после экспорта</Text>
                </Checkbox.Label>
              </Checkbox.Root>
            </VStack>
          </Box>

          {/* Preview */}
          <Box p={3} bg="bg.subtle" borderRadius="md">
            <Text fontWeight="medium" fontSize="sm" mb={2}>
              Пример:
            </Text>
            {previewInfo.folderPath && (
              <Text fontSize="xs" color="fg.muted" mb={1}>
                📁 {outputDir || '...'}/{previewInfo.folderPath}
              </Text>
            )}
            <Text fontSize="sm" color="purple.300">
              {previewInfo.folderPath ? '└── ' : ''}
              {previewInfo.sampleFileName}
            </Text>
          </Box>
        </VStack>
      </Dialog.Body>

      <Dialog.Footer>
        <HStack gap={2}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button colorPalette="purple" onClick={handleStartExport}>
            <Icon as={LuPlay} mr={2} />
            Экспортировать
          </Button>
        </HStack>
      </Dialog.Footer>
    </>
  )

  // Рендер шага прогресса
  const renderProgressStep = () => {
    const currentEp = progress?.episodes[progress.currentEpisodeIndex]
    const overallPercent = progress
      ? ((progress.completedEpisodes + (currentEp?.percent || 0) / 100) / progress.totalEpisodes) * 100
      : 0

    return (
      <>
        <Dialog.Body>
          <VStack gap={4} align="stretch">
            {/* Общий прогресс */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="medium">Экспорт сериала</Text>
                <Text color="fg.muted">
                  {progress?.completedEpisodes || 0} / {progress?.totalEpisodes || 0} эпизодов
                </Text>
              </HStack>
              <Progress.Root value={overallPercent}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>

            {/* Текущий эпизод */}
            {currentEp && (
              <Box p={4} bg="bg.subtle" borderRadius="md">
                <HStack justify="space-between" mb={2}>
                  <Text>
                    Эпизод {currentEp.episodeNumber} (Сезон {currentEp.seasonNumber})
                  </Text>
                  <Text color="fg.muted">{Math.round(currentEp.percent)}%</Text>
                </HStack>
                <Progress.Root value={currentEp.percent} colorPalette="purple">
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Box>
            )}

            {/* Список эпизодов */}
            <Box maxH="200px" overflowY="auto">
              <VStack gap={1} align="stretch">
                {progress?.episodes.map((ep) => (
                  <Flex
                    key={ep.episodeId}
                    justify="space-between"
                    align="center"
                    p={2}
                    bg={ep.status === 'processing' ? 'purple.900' : 'bg.subtle'}
                    borderRadius="md"
                  >
                    <Text fontSize="sm">
                      S{String(ep.seasonNumber).padStart(2, '0')}E{String(ep.episodeNumber).padStart(2, '0')}
                    </Text>
                    <HStack gap={2}>
                      {ep.status === 'pending' && <Badge colorPalette="gray">Ожидание</Badge>}
                      {ep.status === 'processing' && <Badge colorPalette="purple">{Math.round(ep.percent)}%</Badge>}
                      {ep.status === 'completed' && (
                        <Badge colorPalette="green">
                          <Icon as={LuCheck} />
                        </Badge>
                      )}
                      {ep.status === 'error' && (
                        <Badge colorPalette="red">
                          <Icon as={LuX} />
                        </Badge>
                      )}
                      {ep.status === 'skipped' && <Badge colorPalette="yellow">Пропущен</Badge>}
                    </HStack>
                  </Flex>
                ))}
              </VStack>
            </Box>
          </VStack>
        </Dialog.Body>

        <Dialog.Footer>
          <Button colorPalette="red" variant="outline" onClick={handleCancel} disabled={!isExporting}>
            <Icon as={LuX} mr={2} />
            Отменить
          </Button>
        </Dialog.Footer>
      </>
    )
  }

  // Рендер шага результата
  const renderDoneStep = () => (
    <>
      <Dialog.Body>
        <VStack gap={4} align="stretch">
          {result?.success ? (
            <>
              <Box p={4} bg="green.subtle" borderRadius="md" textAlign="center">
                <Icon as={LuCheck} boxSize={8} color="green.fg" mb={2} />
                <Text fontWeight="bold" fontSize="lg" color="green.fg">
                  Экспорт завершён!
                </Text>
                <Text color="green.fg" opacity={0.8}>
                  Экспортировано {result.exportedFiles.length} файлов
                </Text>
              </Box>

              {/* Пропущенные эпизоды */}
              {result.skippedEpisodes.length > 0 && (
                <Box>
                  <Text fontWeight="medium" mb={2} color="yellow.300">
                    Пропущено ({result.skippedEpisodes.length}):
                  </Text>
                  <VStack gap={1} align="stretch">
                    {result.skippedEpisodes.map((ep) => (
                      <Text key={ep.episodeId} fontSize="sm" color="fg.muted">
                        • {ep.reason}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Ошибки */}
              {result.failedEpisodes.length > 0 && (
                <Box>
                  <Text fontWeight="medium" mb={2} color="red.300">
                    Ошибки ({result.failedEpisodes.length}):
                  </Text>
                  <VStack gap={1} align="stretch">
                    {result.failedEpisodes.map((ep) => (
                      <Text key={ep.episodeId} fontSize="sm" color="red.400">
                        • {ep.error}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              )}
            </>
          ) : (
            <Box p={4} bg="red.subtle" borderRadius="md" textAlign="center">
              <Icon as={LuX} boxSize={8} color="red.fg" mb={2} />
              <Text fontWeight="bold" fontSize="lg" color="red.fg">
                Экспорт не удался
              </Text>
              {result?.failedEpisodes.map((ep) => (
                <Text key={ep.episodeId} color="red.fg" opacity={0.8} fontSize="sm">
                  {ep.error}
                </Text>
              ))}
            </Box>
          )}
        </VStack>
      </Dialog.Body>

      <Dialog.Footer>
        <Button colorPalette="purple" onClick={() => onOpenChange(false)}>
          Закрыть
        </Button>
      </Dialog.Footer>
    </>
  )

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        // Не закрывать во время экспорта
        if (!isExporting) {
          onOpenChange(e.open)
        }
      }}
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                <HStack>
                  <Icon as={LuDownload} color="purple.400" />
                  <Text>Экспорт в MKV</Text>
                </HStack>
              </Dialog.Title>
            </Dialog.Header>

            {step === 'config' && renderConfigStep()}
            {step === 'progress' && renderProgressStep()}
            {step === 'done' && renderDoneStep()}

            {!isExporting && (
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
