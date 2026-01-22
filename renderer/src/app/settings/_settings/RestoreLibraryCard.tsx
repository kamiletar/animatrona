'use client'

/**
 * Карточка восстановления библиотеки из метафайлов
 *
 * Позволяет:
 * 1. Выбрать папку библиотеки
 * 2. Просканировать на наличие anime.meta.json
 * 3. Показать найденное
 * 4. Начать восстановление
 */

import { Box, Button, Card, Heading, HStack, Icon, Progress, Spinner, Text, VStack } from '@chakra-ui/react'
import { useCallback, useState } from 'react'
import { LuCircleAlert, LuCircleCheck, LuDatabase, LuFolderSearch, LuRotateCcw } from 'react-icons/lu'

import { upsertFile } from '@/app/_actions/file.action'
import type { Settings } from '@/generated/prisma'
import { useCreateAnime, useCreateEpisode, useCreateSeason, useUpsertWatchProgress } from '@/lib/hooks'
import type { AnimeRestoreData, LibraryScanResult } from '@/types/electron'

import type { DefaultPaths } from './types'

interface RestoreLibraryCardProps {
  settings: Settings | null | undefined
  defaultPaths: DefaultPaths | null
}

type RestoreState = 'idle' | 'scanning' | 'scanned' | 'restoring' | 'done' | 'error'

/**
 * Карточка восстановления библиотеки
 */
export function RestoreLibraryCard({ settings, defaultPaths }: RestoreLibraryCardProps) {
  const [state, setState] = useState<RestoreState>('idle')
  const [scanResult, setScanResult] = useState<LibraryScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoreProgress, setRestoreProgress] = useState({ current: 0, total: 0, currentAnime: '' })

  // ZenStack мутации для создания записей
  const { mutateAsync: createAnime } = useCreateAnime()
  const { mutateAsync: createSeason } = useCreateSeason()
  const { mutateAsync: createEpisode } = useCreateEpisode()
  const { mutateAsync: upsertWatchProgress } = useUpsertWatchProgress()

  // Получаем текущий путь к библиотеке
  const libraryPath = settings?.libraryPath || defaultPaths?.libraryPath || ''

  /**
   * Сканирование библиотеки
   */
  const handleScan = useCallback(async () => {
    if (!libraryPath) {
      setError('Путь к библиотеке не указан')
      return
    }

    setState('scanning')
    setError(null)
    setScanResult(null)

    try {
      const result = await window.electronAPI?.backup.scanLibraryForRestore(libraryPath, true)

      if (!result?.success) {
        setError(result?.error || 'Ошибка сканирования')
        setState('error')
        return
      }

      setScanResult(result)
      setState('scanned')
    } catch (err) {
      setError(String(err))
      setState('error')
    }
  }, [libraryPath])

  /**
   * Восстановление библиотеки
   */
  const handleRestore = useCallback(async () => {
    if (!scanResult?.animes.length) {
      setError('Нечего восстанавливать')
      return
    }

    setState('restoring')
    setError(null)
    setRestoreProgress({ current: 0, total: scanResult.animes.length, currentAnime: '' })

    try {
      for (let i = 0; i < scanResult.animes.length; i++) {
        const animeData = scanResult.animes[i]
        setRestoreProgress({
          current: i + 1,
          total: scanResult.animes.length,
          currentAnime: animeData.meta.fallbackInfo.name,
        })

        await restoreAnime(animeData)
      }

      setState('done')
    } catch (err) {
      setError(String(err))
      setState('error')
    }
  }, [scanResult])

  /**
   * Восстанавливает одно аниме с эпизодами
   */
  const restoreAnime = async (animeData: AnimeRestoreData) => {
    // Определяем данные для создания аниме
    const shikimori = animeData.shikimoriData
    const fallback = animeData.meta.fallbackInfo

    // Маппинг статуса из Shikimori в наш enum
    const mapAnimeStatus = (status?: string): 'ONGOING' | 'COMPLETED' | 'ANNOUNCED' => {
      if (status === 'ongoing') {return 'ONGOING'}
      if (status === 'released') {return 'COMPLETED'}
      if (status === 'anons') {return 'ANNOUNCED'}
      return 'COMPLETED'
    }

    // Маппинг типа главы в enum
    const mapChapterType = (type: string): 'CHAPTER' | 'OP' | 'ED' | 'RECAP' | 'PREVIEW' => {
      const typeMap: Record<string, 'CHAPTER' | 'OP' | 'ED' | 'RECAP' | 'PREVIEW'> = {
        chapter: 'CHAPTER',
        op: 'OP',
        ed: 'ED',
        recap: 'RECAP',
        preview: 'PREVIEW',
      }
      return typeMap[type.toLowerCase()] || 'CHAPTER'
    }

    // === Восстановление постера ===
    let posterId: string | null = null

    // Попытка 1: Локальный постер (приоритет)
    if (animeData.posterPath) {
      const metadata = await window.electronAPI?.fs.getImageMetadata(animeData.posterPath)
      if (metadata?.success && metadata.width && metadata.height) {
        // Извлекаем имя файла из пути
        const filename = animeData.posterPath.split(/[/\\]/).pop() || 'poster.jpg'
        const file = await upsertFile({
          filename,
          path: animeData.posterPath,
          mimeType: metadata.mimeType || 'image/jpeg',
          size: metadata.size || 0,
          width: metadata.width,
          height: metadata.height,
          blurDataURL: metadata.blurDataURL || null,
          category: 'POSTER',
          source: 'restore',
        })
        posterId = file.id
      }
    } // Попытка 2: Скачать из Shikimori (если нет локального)
    else if (shikimori?.poster?.originalUrl && animeData.folder && animeData.meta.shikimoriId) {
      const result = await window.electronAPI?.shikimori.downloadPoster(
        shikimori.poster.originalUrl,
        String(animeData.meta.shikimoriId),
        { savePath: animeData.folder },
      )
      if (result?.success && result.localPath) {
        const file = await upsertFile({
          filename: result.filename || 'poster.jpg',
          path: result.localPath,
          mimeType: result.mimeType || 'image/jpeg',
          size: result.size || 0,
          width: result.width || null,
          height: result.height || null,
          blurDataURL: result.blurDataURL || null,
          category: 'POSTER',
          source: 'shikimori',
        })
        posterId = file.id
      }
    }

    // Создаём аниме
    const anime = await createAnime({
      data: {
        shikimoriId: animeData.meta.shikimoriId,
        posterId, // Привязка постера
        name: shikimori?.russian || shikimori?.name || fallback.name,
        originalName: shikimori?.name || fallback.originalName || null,
        description: shikimori?.description || null,
        rating: shikimori?.score || null,
        year: shikimori?.airedOn?.year || fallback.year || null,
        status: mapAnimeStatus(shikimori?.status),
        episodeCount: shikimori?.episodes || animeData.episodes.length,
        isBdRemux: animeData.meta.isBdRemux,
        folderPath: animeData.folder,
        watchStatus: (animeData.userData?.watchStatus || 'NOT_STARTED') as
          | 'NOT_STARTED'
          | 'WATCHING'
          | 'COMPLETED'
          | 'ON_HOLD'
          | 'DROPPED'
          | 'PLANNED',
        userRating: animeData.userData?.userRating ?? null,
        watchedAt: animeData.userData?.watchedAt ? new Date(animeData.userData.watchedAt) : null,
        // Track preferences
        lastSelectedAudioDubGroup: animeData.userData?.trackPreferences?.audioDubGroup || null,
        lastSelectedAudioLanguage: animeData.userData?.trackPreferences?.audioLanguage || null,
        lastSelectedSubtitleDubGroup: animeData.userData?.trackPreferences?.subtitleDubGroup || null,
        lastSelectedSubtitleLanguage: animeData.userData?.trackPreferences?.subtitleLanguage || null,
        // Альтернативные названия для полнотекстового поиска
        synonyms: shikimori?.synonyms?.length ? JSON.stringify(shikimori.synonyms) : null,
      },
    })

    // Группируем эпизоды по сезонам
    const seasonNumbers = [...new Set(animeData.episodes.map((e) => e.seasonNumber))]
    const seasonMap = new Map<number, string>()

    // Создаём сезоны
    for (const seasonNum of seasonNumbers) {
      const season = await createSeason({
        data: {
          animeId: anime.id,
          number: seasonNum,
        },
      })
      seasonMap.set(seasonNum, season.id)
    }

    // Создаём эпизоды
    for (const epData of animeData.episodes) {
      const seasonId = seasonMap.get(epData.seasonNumber) || null

      const episode = await createEpisode({
        data: {
          animeId: anime.id,
          seasonId,
          number: epData.number,
          name: epData.name || null,
          durationMs: epData.durationMs,
          sourcePath: null, // Исходник обычно удалён после транскодирования
          transcodedPath: epData.videoPath,
          manifestPath: epData.manifestPath,
          transcodeStatus: epData.videoPath ? 'COMPLETED' : 'QUEUED',
          // Audio tracks, subtitles, chapters создаются отдельно или через include
          audioTracks: {
            create: epData.audioTracks.map((track) => ({
              streamIndex: track.streamIndex,
              language: track.language,
              title: track.title,
              codec: track.codec,
              channels: track.channels,
              bitrate: track.bitrate || null,
              isDefault: track.isDefault,
              transcodedPath: track.filePath,
              dubGroup: extractDubGroup(track.title),
            })),
          },
          subtitleTracks: {
            create: epData.subtitleTracks.map((track) => ({
              streamIndex: track.streamIndex,
              language: track.language,
              title: track.title,
              format: track.format,
              filePath: track.filePath,
              isDefault: track.isDefault,
              dubGroup: extractDubGroup(track.title),
              fonts: {
                create: track.fonts.map((font) => ({
                  fontName: font.name,
                  filePath: font.path,
                })),
              },
            })),
          },
          chapters: {
            create: epData.chapters.map((ch) => ({
              startMs: ch.startMs,
              endMs: ch.endMs,
              title: ch.title,
              type: mapChapterType(ch.type),
              skippable: ch.skippable,
            })),
          },
        },
      })

      // Создаём прогресс просмотра если есть
      if (epData.userProgress) {
        await upsertWatchProgress({
          where: {
            animeId_episodeId: {
              animeId: anime.id,
              episodeId: episode.id,
            },
          },
          create: {
            animeId: anime.id,
            episodeId: episode.id,
            currentTime: epData.userProgress.currentTime,
            completed: epData.userProgress.completed,
            lastWatchedAt: new Date(epData.userProgress.lastWatchedAt),
            // selectedAudioTrackId и selectedSubtitleTrackId мы не можем восстановить по ID
            // потому что у новых дорожек будут новые ID
            // Пользователь выберет дорожки заново при просмотре
          },
          update: {
            currentTime: epData.userProgress.currentTime,
            completed: epData.userProgress.completed,
            lastWatchedAt: new Date(epData.userProgress.lastWatchedAt),
          },
        })
      }
    }
  }

  /**
   * Сброс состояния
   */
  const handleReset = useCallback(() => {
    setState('idle')
    setScanResult(null)
    setError(null)
    setRestoreProgress({ current: 0, total: 0, currentAnime: '' })
  }, [])

  return (
    <Card.Root bg="bg.panel" border="1px" borderColor="border.subtle">
      <Card.Header>
        <HStack gap={3}>
          <Icon as={LuDatabase} color="purple.400" boxSize={5} />
          <Heading size="md">Восстановление библиотеки</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <VStack gap={4} align="stretch">
          <Text color="fg.subtle" fontSize="sm">
            Восстановите библиотеку из папки, если база данных была сброшена. Аниме восстанавливаются из метафайлов
            (anime.meta.json, progress.meta.json).
          </Text>

          {/* Текущая папка */}
          <Box p={3} bg="bg.subtle" borderRadius="md">
            <Text fontSize="sm" color="fg.muted" mb={1}>
              Папка библиотеки:
            </Text>
            <Text color="fg">{libraryPath || 'Не указана'}</Text>
          </Box>

          {/* Действия в зависимости от состояния */}
          {state === 'idle' && (
            <Button colorPalette="purple" onClick={handleScan} disabled={!libraryPath}>
              <Icon as={LuFolderSearch} mr={2} />
              Сканировать библиотеку
            </Button>
          )}

          {state === 'scanning' && (
            <HStack justify="center" py={4}>
              <Spinner color="purple.400" />
              <Text color="fg.muted">Сканирование папки...</Text>
            </HStack>
          )}

          {state === 'scanned' && scanResult && (
            <VStack gap={3} align="stretch">
              {/* Статистика */}
              <Box p={4} bg="bg.subtle" borderRadius="md">
                <HStack gap={4} wrap="wrap">
                  <VStack align="start" gap={0}>
                    <Text color="fg.muted" fontSize="xs">
                      Найдено аниме
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="purple.400">
                      {scanResult.stats.totalAnimes}
                    </Text>
                  </VStack>
                  <VStack align="start" gap={0}>
                    <Text color="fg.muted" fontSize="xs">
                      Эпизодов
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="blue.400">
                      {scanResult.stats.totalEpisodes}
                    </Text>
                  </VStack>
                  <VStack align="start" gap={0}>
                    <Text color="fg.muted" fontSize="xs">
                      С Shikimori ID
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="orange.400">
                      {scanResult.stats.withShikimoriId}
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              {/* Предупреждения */}
              {scanResult.warnings.length > 0 && (
                <Box p={3} bg="yellow.500/10" borderRadius="md" border="1px" borderColor="yellow.500/30">
                  <HStack mb={2}>
                    <Icon as={LuCircleAlert} color="yellow.400" />
                    <Text color="yellow.400" fontSize="sm" fontWeight="medium">
                      Предупреждения ({scanResult.warnings.length})
                    </Text>
                  </HStack>
                  <VStack align="start" gap={1}>
                    {scanResult.warnings.slice(0, 5).map((warning, i) => (
                      <Text key={i} color="yellow.300" fontSize="xs">
                        • {warning}
                      </Text>
                    ))}
                    {scanResult.warnings.length > 5 && (
                      <Text color="yellow.300/70" fontSize="xs">
                        ...и ещё {scanResult.warnings.length - 5}
                      </Text>
                    )}
                  </VStack>
                </Box>
              )}

              {/* Кнопки действий */}
              <HStack gap={2}>
                <Button colorPalette="green" onClick={handleRestore} flex={1} disabled={!scanResult.stats.totalAnimes}>
                  <Icon as={LuRotateCcw} mr={2} />
                  Восстановить
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Отмена
                </Button>
              </HStack>
            </VStack>
          )}

          {state === 'restoring' && (
            <VStack gap={3} align="stretch">
              <HStack>
                <Spinner color="purple.400" size="sm" />
                <Text color="fg.muted">
                  Восстановление: {restoreProgress.current} / {restoreProgress.total}
                </Text>
              </HStack>
              <Progress.Root value={(restoreProgress.current / restoreProgress.total) * 100}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Text fontSize="sm" color="fg.subtle">
                {restoreProgress.currentAnime}
              </Text>
            </VStack>
          )}

          {state === 'done' && (
            <VStack gap={3} align="stretch">
              <HStack justify="center" py={4}>
                <Icon as={LuCircleCheck} color="green.400" boxSize={6} />
                <Text color="green.400" fontWeight="medium">
                  Библиотека успешно восстановлена!
                </Text>
              </HStack>
              <Button variant="outline" onClick={handleReset}>
                Готово
              </Button>
            </VStack>
          )}

          {state === 'error' && error && (
            <VStack gap={3} align="stretch">
              <Box p={3} bg="red.500/10" borderRadius="md" border="1px" borderColor="red.500/30">
                <HStack mb={2}>
                  <Icon as={LuCircleAlert} color="red.400" />
                  <Text color="red.400" fontWeight="medium">
                    Ошибка
                  </Text>
                </HStack>
                <Text color="red.300" fontSize="sm">
                  {error}
                </Text>
              </Box>
              <Button variant="outline" onClick={handleReset}>
                Попробовать снова
              </Button>
            </VStack>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

/**
 * Извлекает dubGroup из названия дорожки
 * Пример: "AniLibria" из "Русский (AniLibria)"
 */
function extractDubGroup(title: string): string | null {
  const match = title.match(/\(([^)]+)\)/)
  return match ? match[1] : null
}
