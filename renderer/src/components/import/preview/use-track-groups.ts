'use client'

/**
 * Хук для группировки и редактирования дорожек (аудио/субтитры)
 *
 * Дорожки группируются для batch-редактирования:
 * - Встроенные MKV: по streamIndex (все файлы с track #0 = одна группа)
 * - Внешние файлы: по папке (все из "Rus Sub/" = одна группа)
 */

import { useCallback, useMemo } from 'react'

import { createTrackGroupId, extractGroupFromPath, formatSubtitleType, parseTrackGroupId } from '@/constants/dub-groups'

import type { AudioRecommendation, FileAnalysis, SubtitleRecommendation, TrackGroup, TrackGroupEdit } from './types'

/** Опции для хука */
interface UseTrackGroupsOptions {
  /** Текущий анализ файла */
  analysis: FileAnalysis
}

/**
 * Хук для группировки и редактирования дорожек
 */
export function useTrackGroups(options: UseTrackGroupsOptions) {
  const { analysis } = options
  const { audioRecommendations, subtitleRecommendations } = analysis

  /**
   * Группы аудиодорожек
   * - Встроенные группируются по trackIndex (один trackIndex = одна группа для всех файлов)
   * - Внешние группируются по папке
   */
  const audioGroups = useMemo((): TrackGroup[] => {
    const groupMap = new Map<string, TrackGroup>()

    audioRecommendations.forEach((rec, idx) => {
      const groupId = rec.groupId || createAudioGroupId(rec)

      if (!groupMap.has(groupId)) {
        const { type } = parseTrackGroupId(groupId)
        const displayName = getAudioDisplayName(rec, type)

        groupMap.set(groupId, {
          groupId,
          type,
          displayName,
          trackCount: 0,
          language: rec.language,
          dubGroup: rec.dubGroup || rec.groupName,
          trackIndices: [],
        })
      }

      const group = groupMap.get(groupId)!
      group.trackCount++
      group.trackIndices.push(idx)

      // Если language или dubGroup различаются — убираем общее значение
      if (group.language !== rec.language) {
        group.language = undefined
      }
      if (group.dubGroup !== (rec.dubGroup || rec.groupName)) {
        group.dubGroup = undefined
      }
    })

    return Array.from(groupMap.values())
  }, [audioRecommendations])

  /**
   * Группы субтитров
   * - Встроенные группируются по streamIndex
   * - Внешние группируются по папке
   */
  const subtitleGroups = useMemo((): TrackGroup[] => {
    const groupMap = new Map<string, TrackGroup>()

    subtitleRecommendations.forEach((rec, idx) => {
      const groupId = rec.groupId || createSubtitleGroupId(rec)

      if (!groupMap.has(groupId)) {
        const { type } = parseTrackGroupId(groupId)
        const displayName = getSubtitleDisplayName(rec, type)

        groupMap.set(groupId, {
          groupId,
          type,
          displayName,
          trackCount: 0,
          language: rec.language,
          dubGroup: rec.dubGroup,
          subtitleType: rec.subtitleType,
          trackIndices: [],
        })
      }

      const group = groupMap.get(groupId)!
      group.trackCount++
      group.trackIndices.push(idx)

      // Если language, dubGroup или subtitleType различаются — убираем общее значение
      if (group.language !== rec.language) {
        group.language = undefined
      }
      if (group.dubGroup !== rec.dubGroup) {
        group.dubGroup = undefined
      }
      if (group.subtitleType !== rec.subtitleType) {
        group.subtitleType = undefined
      }
    })

    return Array.from(groupMap.values())
  }, [subtitleRecommendations])

  /**
   * Применить редактирование к группе аудиодорожек
   */
  const applyAudioGroupEdit = useCallback(
    (groupId: string, edit: TrackGroupEdit): AudioRecommendation[] => {
      return audioRecommendations.map((rec) => {
        const recGroupId = rec.groupId || createAudioGroupId(rec)
        if (recGroupId !== groupId) return rec

        return {
          ...rec,
          language: edit.language ?? rec.language,
          dubGroup: edit.dubGroup !== undefined ? (edit.dubGroup ?? undefined) : rec.dubGroup,
          groupId: recGroupId,
        }
      })
    },
    [audioRecommendations]
  )

  /**
   * Применить редактирование к группе субтитров
   */
  const applySubtitleGroupEdit = useCallback(
    (groupId: string, edit: TrackGroupEdit): SubtitleRecommendation[] => {
      return subtitleRecommendations.map((rec) => {
        const recGroupId = rec.groupId || createSubtitleGroupId(rec)
        if (recGroupId !== groupId) return rec

        return {
          ...rec,
          language: edit.language ?? rec.language,
          dubGroup: edit.dubGroup !== undefined ? (edit.dubGroup ?? undefined) : rec.dubGroup,
          subtitleType: edit.subtitleType ?? rec.subtitleType,
          groupId: recGroupId,
        }
      })
    },
    [subtitleRecommendations]
  )

  return {
    audioGroups,
    subtitleGroups,
    applyAudioGroupEdit,
    applySubtitleGroupEdit,
    hasGroups: audioGroups.length > 0 || subtitleGroups.length > 0,
  }
}

/**
 * Создать groupId для аудиодорожки
 */
function createAudioGroupId(rec: AudioRecommendation): string {
  if (rec.isExternal && rec.externalPath) {
    // Внешние: группируем по папке
    const folderName = extractGroupFromPath(rec.externalPath)
    return createTrackGroupId(true, folderName || 'external')
  }
  // Встроенные: группируем по trackIndex
  return createTrackGroupId(false, rec.trackIndex)
}

/**
 * Создать groupId для субтитров
 */
function createSubtitleGroupId(rec: SubtitleRecommendation): string {
  if (rec.isExternal && rec.externalPath) {
    // Внешние: группируем по папке
    const folderName = extractGroupFromPath(rec.externalPath)
    return createTrackGroupId(true, folderName || 'external')
  }
  // Встроенные: группируем по streamIndex
  return createTrackGroupId(false, rec.streamIndex)
}

/**
 * Получить отображаемое имя для группы аудио
 */
function getAudioDisplayName(rec: AudioRecommendation, type: 'embedded' | 'external'): string {
  if (type === 'external') {
    const folderName = extractGroupFromPath(rec.externalPath)
    return folderName || 'Внешние аудио'
  }
  return `Встроенные #${rec.trackIndex}`
}

/**
 * Получить отображаемое имя для группы субтитров
 */
function getSubtitleDisplayName(rec: SubtitleRecommendation, type: 'embedded' | 'external'): string {
  const typeSuffix = rec.subtitleType && rec.subtitleType !== 'full' ? ` [${formatSubtitleType(rec.subtitleType)}]` : ''

  if (type === 'external') {
    const folderName = extractGroupFromPath(rec.externalPath)
    return (folderName || 'Внешние субтитры') + typeSuffix
  }
  return `Встроенные #${rec.streamIndex}${typeSuffix}`
}

export type UseTrackGroupsReturn = ReturnType<typeof useTrackGroups>
