'use client'

/**
 * Шаг предпросмотра и настроек перед импортом
 *
 * Анализирует файлы, показывает информацию о дорожках и позволяет изменить настройки.
 * VMAF подбор CQ теперь выполняется в очереди импорта, не здесь.
 */

import { Badge, Box, Button, HStack, Icon, Progress, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuRefreshCw, LuX } from 'react-icons/lu'

import {
  EncodingSettingsCard,
  FileCard,
  useEncodingSettings,
  usePreviewAnalysis,
  type AudioRecommendation,
  type FileAnalysis,
  type ImportSettings,
  type PreviewStepProps,
  type SubtitleRecommendation,
} from './preview'

/**
 * Шаг предпросмотра
 * Использует probe вместо demux для анализа без извлечения файлов
 */
export function PreviewStep({ files, folderPath, onAnalysisComplete, onSettingsChange }: PreviewStepProps) {
  // Хук для анализа файлов
  const analysis = usePreviewAnalysis({
    files,
    folderPath,
    onAnalysisComplete,
  })

  // Хук для настроек кодирования
  const encodingSettings = useEncodingSettings({
    onSettingsChange,
  })

  return (
    <VStack gap={4} align="stretch">
      {/* Заголовок и прогресс */}
      <HStack justify="space-between">
        <VStack align="start" gap={0}>
          <Text fontWeight="medium">Предпросмотр ({analysis.selectedFiles.length} файлов)</Text>
          <Text fontSize="sm" color="fg.muted">
            Анализ дорожек и настройки транскодирования
          </Text>
        </VStack>

        {!analysis.isAnalyzing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={analysis.startAnalysis}
            disabled={analysis.selectedFiles.length === 0}
          >
            <Icon as={LuRefreshCw} mr={2} />
            Перезапустить
          </Button>
        )}
      </HStack>

      {/* Общий прогресс */}
      {analysis.isAnalyzing && (
        <VStack gap={2} align="stretch">
          <Progress.Root value={analysis.overallProgress} size="sm" colorPalette="purple">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Анализ файлов... {Math.round(analysis.overallProgress)}%
          </Text>
        </VStack>
      )}

      {/* Статистика */}
      {!analysis.isAnalyzing && analysis.analyses.length > 0 && (
        <HStack gap={4}>
          <Badge colorPalette="green">
            <LuCheck /> {analysis.analyzedCount} готово
          </Badge>
          {analysis.errorCount > 0 && (
            <Badge colorPalette="red">
              <LuX /> {analysis.errorCount} ошибок
            </Badge>
          )}
        </HStack>
      )}

      {/* Настройки импорта */}
      {!analysis.isAnalyzing && analysis.analyzedCount > 0 && <EncodingSettingsCard settings={encodingSettings} />}

      {/* Список файлов */}
      <VStack gap={3} align="stretch" maxH="300px" overflowY="auto">
        {analysis.analyses.map((item) => (
          <FileCard
            key={item.file.path}
            analysis={item}
            folderPath={folderPath}
            onToggleTrack={analysis.handleToggleTrack}
            onToggleSubtitle={analysis.handleToggleSubtitle}
          />
        ))}
      </VStack>

      {/* Легенда */}
      {!analysis.isAnalyzing && analysis.analyzedCount > 0 && (
        <Box p={3} bg="bg.subtle" borderRadius="md">
          <Text fontSize="xs" color="fg.subtle">
            💡 <strong>Пропустить</strong> — дорожка уже в оптимальном формате. <strong>Транскодировать</strong> — будет
            перекодировано в AAC 256 kbps для уменьшения размера.
          </Text>
        </Box>
      )}
    </VStack>
  )
}

// Реэкспорт типов для обратной совместимости
export type { AudioRecommendation, FileAnalysis, ImportSettings, SubtitleRecommendation }
