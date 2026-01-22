/**
 * PlayerControls — нижняя панель управления плеером
 *
 * Содержит:
 * - Прогресс бар (seekable)
 * - Кнопки воспроизведения (play/pause, skip)
 * - Таймер (current / duration)
 * - Громкость (mute, slider)
 * - Fullscreen
 *
 * Оптимизации:
 * - useMemo для маркеров глав (не зависят от currentTime)
 * - React.memo для компонента (много props, частые рендеры)
 */

import { Box, HStack, Icon, IconButton, Menu, Portal, Slider, Text } from '@chakra-ui/react'
import { memo, useMemo } from 'react'
import {
  LuChevronLeft,
  LuChevronRight,
  LuGauge,
  LuMaximize,
  LuMinimize,
  LuPause,
  LuPictureInPicture,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuVolume2,
  LuVolumeX,
} from 'react-icons/lu'

import { Tooltip } from '@/components/ui/tooltip'

import { SKIP_TIME } from '../constants'

/** Доступные скорости воспроизведения */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

/** Информация о главе для маркеров */
export interface ChapterInfo {
  id: string
  title: string
  startTime: number
}

export interface PlayerControlsProps {
  /** Видео воспроизводится */
  isPlaying: boolean
  /** Текущее время (секунды) */
  currentTime: number
  /** Длительность (секунды) */
  duration: number
  /** Громкость (0-1) */
  volume: number
  /** Звук выключен */
  isMuted: boolean
  /** Полноэкранный режим */
  isFullscreen: boolean
  /** Показывать контролы */
  isVisible: boolean
  /** Toggle play/pause */
  onTogglePlay: () => void
  /** Seek по прогресс-бару */
  onSeek: (value: number[]) => void
  /** Изменение громкости */
  onVolumeChange: (value: number[]) => void
  /** Toggle mute */
  onToggleMute: () => void
  /** Toggle fullscreen */
  onToggleFullscreen: () => void
  /** Skip time (seconds) */
  onSkipTime: (seconds: number) => void
  /** Главы для маркеров на прогресс-баре */
  chapters?: ChapterInfo[]
  /** Переход к главе */
  onChapterSeek?: (time: number) => void
  /** Есть предыдущий эпизод */
  hasPrevEpisode?: boolean
  /** Есть следующий эпизод */
  hasNextEpisode?: boolean
  /** Переход к предыдущему эпизоду */
  onPrevEpisode?: () => void
  /** Переход к следующему эпизоду */
  onNextEpisode?: () => void
  /** Tooltip для предыдущего эпизода */
  prevEpisodeTooltip?: string
  /** Tooltip для следующего эпизода */
  nextEpisodeTooltip?: string
  /** Скорость воспроизведения (v0.7.0) */
  playbackSpeed?: PlaybackSpeed
  /** Изменение скорости воспроизведения */
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void
  /** Picture-in-Picture режим активен */
  isPiP?: boolean
  /** Toggle Picture-in-Picture */
  onTogglePiP?: () => void
}

/**
 * Форматирует время в mm:ss или hh:mm:ss
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) {
    return '0:00'
  }

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Компонент нижней панели управления плеером
 *
 * Мемоизирован через React.memo для предотвращения лишних рендеров
 * при частых обновлениях currentTime (~4 раза в секунду)
 */
export const PlayerControls = memo(function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  isVisible,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onSkipTime,
  chapters,
  onChapterSeek,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  prevEpisodeTooltip,
  nextEpisodeTooltip,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  isPiP,
  onTogglePiP,
}: PlayerControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Мемоизируем маркеры глав — они не зависят от currentTime
  const chapterMarkers = useMemo(() => {
    if (!chapters || chapters.length === 0 || duration <= 0) {
      return null
    }

    return chapters.map((chapter) => {
      const position = (chapter.startTime / duration) * 100
      return {
        id: chapter.id,
        title: chapter.title,
        position,
        startTime: chapter.startTime,
      }
    })
  }, [chapters, duration])

  return (
    <Box
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      bg="linear-gradient(transparent, rgba(0,0,0,0.9))"
      pt={16}
      pb={4}
      px={4}
      opacity={isVisible ? 1 : 0}
      pointerEvents={isVisible ? 'auto' : 'none'}
      transition="opacity 0.3s"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Прогресс бар с маркерами глав */}
      <Box position="relative" mb={3}>
        <Slider.Root value={[progress]} min={0} max={100} step={0.1} onValueChange={(e) => onSeek(e.value)}>
          <Slider.Control>
            <Slider.Track h="4px" bg="player.track">
              <Slider.Range bg="player.range" />
            </Slider.Track>
            <Slider.Thumb index={0} boxSize={4} bg="player.thumb" />
          </Slider.Control>
        </Slider.Root>

        {/* Маркеры глав (мемоизированы) */}
        {chapterMarkers && (
          <Box position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="none">
            {chapterMarkers.map((marker) => (
              <Tooltip key={marker.id} content={marker.title}>
                <Box
                  position="absolute"
                  left={`${marker.position}%`}
                  top="50%"
                  transform="translate(-50%, -50%)"
                  w="2px"
                  h="12px"
                  bg="player.marker"
                  opacity={0.9}
                  borderRadius="full"
                  cursor="pointer"
                  pointerEvents="auto"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChapterSeek?.(marker.startTime)
                  }}
                  _hover={{
                    h: '16px',
                    opacity: 1,
                    bg: 'player.marker.hover',
                  }}
                  transition="all 0.15s"
                />
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      <HStack justify="space-between" align="center">
        {/* Левая часть: воспроизведение и время */}
        <HStack gap={2}>
          <Tooltip content={`Назад ${SKIP_TIME} сек (←)`}>
            <IconButton
              aria-label="Skip back"
              variant="ghost"
              colorPalette="whiteAlpha"
              size="sm"
              onClick={() => onSkipTime(-SKIP_TIME)}
            >
              <Icon as={LuSkipBack} color="player.control" />
            </IconButton>
          </Tooltip>

          <Tooltip content={isPlaying ? 'Пауза (Space)' : 'Воспроизведение (Space)'}>
            <IconButton
              aria-label={isPlaying ? 'Pause' : 'Play'}
              variant="ghost"
              colorPalette="whiteAlpha"
              size="md"
              onClick={onTogglePlay}
            >
              <Icon as={isPlaying ? LuPause : LuPlay} color="player.control" boxSize={6} />
            </IconButton>
          </Tooltip>

          <Tooltip content={`Вперёд ${SKIP_TIME} сек (→)`}>
            <IconButton
              aria-label="Skip forward"
              variant="ghost"
              colorPalette="whiteAlpha"
              size="sm"
              onClick={() => onSkipTime(SKIP_TIME)}
            >
              <Icon as={LuSkipForward} color="player.control" />
            </IconButton>
          </Tooltip>

          <Text color="player.control" fontSize="sm" ml={2}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>

          {/* Навигация между эпизодами */}
          {(hasPrevEpisode || hasNextEpisode) && (
            <>
              <Tooltip content={prevEpisodeTooltip || 'Предыдущий эпизод'}>
                <IconButton
                  aria-label="Previous episode"
                  variant="ghost"
                  colorPalette="whiteAlpha"
                  size="sm"
                  disabled={!hasPrevEpisode}
                  onClick={onPrevEpisode}
                >
                  <Icon as={LuChevronLeft} color="player.control" />
                </IconButton>
              </Tooltip>
              <Tooltip content={nextEpisodeTooltip || 'Следующий эпизод'}>
                <IconButton
                  aria-label="Next episode"
                  variant="ghost"
                  colorPalette="whiteAlpha"
                  size="sm"
                  disabled={!hasNextEpisode}
                  onClick={onNextEpisode}
                >
                  <Icon as={LuChevronRight} color="player.control" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </HStack>

        {/* Правая часть: скорость, громкость и fullscreen */}
        <HStack gap={2}>
          {/* Скорость воспроизведения (v0.7.0) */}
          {onPlaybackSpeedChange && (
            <Menu.Root>
              <Tooltip content={`Скорость: ${playbackSpeed}x ([ / ])`}>
                <Menu.Trigger asChild>
                  <IconButton aria-label="Скорость воспроизведения" variant="ghost" colorPalette="whiteAlpha" size="sm">
                    <HStack gap={1}>
                      <Icon as={LuGauge} color="player.control" />
                      {playbackSpeed !== 1 && (
                        <Text fontSize="xs" color="player.control" fontWeight="bold">
                          {playbackSpeed}x
                        </Text>
                      )}
                    </HStack>
                  </IconButton>
                </Menu.Trigger>
              </Tooltip>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content bg="bg.muted" borderColor="border" minW="100px">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <Menu.Item
                        key={speed}
                        value={String(speed)}
                        onClick={() => onPlaybackSpeedChange(speed)}
                        cursor="pointer"
                        bg={playbackSpeed === speed ? 'primary.subtle' : undefined}
                        _hover={{ bg: 'state.hover' }}
                      >
                        <HStack justify="space-between" w="full">
                          <Text>{speed}x</Text>
                          {speed === 1 && (
                            <Text fontSize="xs" color="fg.subtle">
                              Обычная
                            </Text>
                          )}
                        </HStack>
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}

          <HStack gap={1} w="120px">
            <Tooltip content={isMuted ? 'Включить звук (M)' : 'Выключить звук (M)'}>
              <IconButton
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                variant="ghost"
                colorPalette="whiteAlpha"
                size="sm"
                onClick={onToggleMute}
              >
                <Icon as={isMuted ? LuVolumeX : LuVolume2} color="player.control" />
              </IconButton>
            </Tooltip>

            <Slider.Root
              value={[isMuted ? 0 : volume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(e) => onVolumeChange(e.value)}
              flex={1}
            >
              <Slider.Control>
                <Slider.Track h="4px" bg="player.track">
                  <Slider.Range bg="player.thumb" />
                </Slider.Track>
                <Slider.Thumb index={0} boxSize={3} bg="player.thumb" />
              </Slider.Control>
            </Slider.Root>
          </HStack>

          {/* Picture-in-Picture */}
          {onTogglePiP && (
            <Tooltip content={isPiP ? 'Выйти из PiP' : 'Картинка в картинке'}>
              <IconButton
                aria-label={isPiP ? 'Exit PiP' : 'Enter PiP'}
                variant="ghost"
                colorPalette="whiteAlpha"
                size="sm"
                onClick={onTogglePiP}
              >
                <Icon as={LuPictureInPicture} color={isPiP ? 'primary.fg' : 'player.control'} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip content={isFullscreen ? 'Выйти из полноэкранного (F)' : 'Полноэкранный режим (F)'}>
            <IconButton
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              variant="ghost"
              colorPalette="whiteAlpha"
              size="sm"
              onClick={onToggleFullscreen}
            >
              <Icon as={isFullscreen ? LuMinimize : LuMaximize} color="player.control" />
            </IconButton>
          </Tooltip>
        </HStack>
      </HStack>
    </Box>
  )
})
