/**
 * Утилита группировки аниме по франшизам
 */

import type { AnimeWithFranchise, FranchiseGroup } from './types'

/**
 * Группирует аниме по франшизам
 * Возвращает группы франшиз и одиночные аниме без франшизы
 * Собирает незагруженные аниме из sourceRelations
 *
 * @param animes — отфильтрованные аниме для отображения
 * @param allLoadedShikimoriIds — shikimoriId ВСЕХ загруженных аниме (без фильтров)
 *                                нужно для корректного определения missingAnimes
 */
export function groupAnimeByFranchise(
  animes: AnimeWithFranchise[],
  allLoadedShikimoriIds: Set<number>
): {
  franchiseGroups: FranchiseGroup[]
  standAloneAnimes: AnimeWithFranchise[]
} {
  const franchiseMap = new Map<string, FranchiseGroup>()
  const standAloneAnimes: AnimeWithFranchise[] = []

  // Используем переданный Set всех загруженных shikimoriId
  // Это позволяет корректно определять missing даже при активных фильтрах
  const loadedShikimoriIds = allLoadedShikimoriIds

  for (const anime of animes) {
    if (anime.franchise) {
      const existing = franchiseMap.get(anime.franchise.id)
      if (existing) {
        existing.animes.push(anime)
      } else {
        franchiseMap.set(anime.franchise.id, {
          franchise: anime.franchise,
          animes: [anime],
          missingAnimes: [],
        })
      }
    } else {
      standAloneAnimes.push(anime)
    }
  }

  // Собираем незагруженные аниме из sourceRelations
  for (const anime of animes) {
    if (!anime.franchise || !anime.sourceRelations) continue

    const group = franchiseMap.get(anime.franchise.id)
    if (!group) continue

    // Фильтруем связи: только незагруженные и с валидным targetName
    const missingFromThisAnime = anime.sourceRelations.filter((rel) => {
      // Пропускаем если аниме уже загружено (по Shikimori ID)
      if (loadedShikimoriIds.has(rel.targetShikimoriId)) return false
      // Пропускаем если уже есть в missingAnimes группы (дедупликация)
      if (group.missingAnimes.some((m) => m.targetShikimoriId === rel.targetShikimoriId)) return false
      // Пропускаем если нет названия
      if (!rel.targetName) return false
      return true
    })

    group.missingAnimes.push(...missingFromThisAnime)
  }

  // Сортируем группы по названию франшизы
  const franchiseGroups = Array.from(franchiseMap.values()).sort((a, b) =>
    a.franchise.name.localeCompare(b.franchise.name)
  )

  return { franchiseGroups, standAloneAnimes }
}
