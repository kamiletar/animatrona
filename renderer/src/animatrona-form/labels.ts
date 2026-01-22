/**
 * Метки для enum'ов Animatrona
 *
 * Реэкспорт из generated form-schemas.
 * Используются в Select компонентах для отображения человекочитаемых названий.
 */

// Аниме
export { AnimeStatusLabels as animeStatusLabels } from '@/generated/form-schemas/enums/AnimeStatus.form'
export { SeasonTypeLabels as seasonTypeLabels } from '@/generated/form-schemas/enums/SeasonType.form'

// Кодирование
export { BRefModeLabels as bRefModeLabels } from '@/generated/form-schemas/enums/BRefMode.form'
export { MultipassLabels as multipassLabels } from '@/generated/form-schemas/enums/Multipass.form'
export { RateControlLabels as rateControlLabels } from '@/generated/form-schemas/enums/RateControl.form'
export { TuneLabels as tuneLabels } from '@/generated/form-schemas/enums/Tune.form'
export { VideoCodecLabels as videoCodecLabels } from '@/generated/form-schemas/enums/VideoCodec.form'

// Главы и медиа
export { ChapterTypeLabels as chapterTypeLabels } from '@/generated/form-schemas/enums/ChapterType.form'
export { FileCategoryLabels as fileCategoryLabels } from '@/generated/form-schemas/enums/FileCategory.form'
export { TranscodeStatusLabels as transcodeStatusLabels } from '@/generated/form-schemas/enums/TranscodeStatus.form'
export { TrackPreferenceLabels as trackPreferenceLabels } from '@/generated/form-schemas/enums/TrackPreference.form'
export { VideoKindLabels as videoKindLabels } from '@/generated/form-schemas/enums/VideoKind.form'

// Метаданные
export { ExternalLinkKindLabels as externalLinkKindLabels } from '@/generated/form-schemas/enums/ExternalLinkKind.form'
export { PersonRoleLabels as personRoleLabels } from '@/generated/form-schemas/enums/PersonRole.form'
export { RelationKindLabels as relationKindLabels } from '@/generated/form-schemas/enums/RelationKind.form'

/**
 * Пресеты кодирования (не enum, кастомные значения)
 */
export const presetLabels: Record<string, string> = {
  p1: 'p1 — Быстро',
  p2: 'p2',
  p3: 'p3',
  p4: 'p4 — Баланс',
  p5: 'p5',
  p6: 'p6',
  p7: 'p7 — Качество',
}
