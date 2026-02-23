'use client'

import { Box, Button, Heading, HStack, Icon, SegmentGroup, Spinner, Text, VStack } from '@chakra-ui/react'
import nextDynamic from 'next/dynamic'
import { Suspense } from 'react'
import { LuGrid2X2, LuImport, LuLayers, LuRefreshCw } from 'react-icons/lu'

import { Header } from '@/components/layout'
import { AnimeFilters, AnimeGrid, DropZone, EmptyLibraryState } from '@/components/library'

import { FranchiseView, useLibraryPage } from './_lib'

// Dynamic imports для диалогов — загружаются только при открытии
const ImportWizardDialog = nextDynamic(
  () => import('@/components/import/ImportWizardDialog').then((mod) => mod.ImportWizardDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> },
)

const DeleteAnimeDialog = nextDynamic(
  () => import('@/components/library/DeleteAnimeDialog').then((mod) => mod.DeleteAnimeDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> },
)

// Отключаем статическую генерацию для страницы библиотеки
export const dynamic = 'force-dynamic'

/**
 * Внутренний компонент страницы библиотеки
 * Выделен для Suspense boundary (useSearchParams требует Suspense)
 */
function LibraryPageContent() {
  const {
    // State
    isImportOpen,
    setIsImportOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setSelectedAnimeId,
    droppedFolderPath,
    viewMode,

    // Данные
    animes,
    genres,
    franchiseGroups,
    standAloneAnimes,
    isLoading,
    isEmptyWithoutFilters,
    selectedAnime,

    // Фильтры
    searchInput,
    setSearchInput,
    urlParams,
    setParam,
    setParams,
    filterCounts,
    isLoadingCounts,
    // v0.28.0: studiosData и directorsData удалены
    dubGroupsData,

    // Handlers
    handleFolderDrop,
    handleImportOpenChange,
    handleViewModeChange,
    handleReset,
    handleCardPlay,
    handleCardExport,
    handleCardRefreshMetadata,
    handleCardDelete,
    handleWatchStatusChange,
    refetch,
  } = useLibraryPage()

  const {
    status,
    yearMin,
    yearMax,
    genre,
    studio,
    fandubber,
    director,
    episodesMin,
    episodesMax,
    resolution,
    bitDepth,
    sortBy,
    watchStatus: watchStatusFilter,
  } = urlParams

  return (
    <DropZone onFolderDrop={handleFolderDrop}>
      <Box minH="100vh" bg="bg" color="fg">
        <Header title="Библиотека" />

        <Box p={6}>
          <VStack gap={6} align="stretch">
            {/* Заголовок и действия */}
            <HStack justify="space-between">
              <Box>
                <Heading size="lg">Библиотека аниме</Heading>
                <Text color="fg.subtle">{animes.length} тайтлов в коллекции</Text>
              </Box>
              <HStack gap={2}>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <Icon as={LuRefreshCw} mr={2} />
                  Обновить
                </Button>
                <Button colorPalette="purple" size="sm" onClick={() => setIsImportOpen(true)}>
                  <Icon as={LuImport} mr={2} />
                  Импорт видео
                </Button>
              </HStack>
            </HStack>

            {/* Фильтры и переключатель режима */}
            <HStack justify="space-between" align="start" flexWrap="wrap" gap={4}>
              <Box flex={1} minW="300px">
                <AnimeFilters
                  search={searchInput}
                  onSearchChange={setSearchInput}
                  status={status}
                  onStatusChange={(v) => setParam('status', v)}
                  yearMin={yearMin}
                  onYearMinChange={(v) => setParam('yearMin', v)}
                  yearMax={yearMax}
                  onYearMaxChange={(v) => setParam('yearMax', v)}
                  onYearRangeClear={() => setParams({ yearMin: '', yearMax: '' })}
                  genre={genre}
                  onGenreChange={(v) => setParam('genre', v)}
                  genres={genres}
                  // Расширенные фильтры
                  studio={studio}
                  onStudioChange={(v) => setParam('studio', v)}
                  studios={[]} // v0.28.0: студии теперь в AnimeManifest (IPFS)
                  fandubber={fandubber}
                  onFandubberChange={(v) => setParam('fandubber', v)}
                  fandubbers={dubGroupsData}
                  director={director}
                  onDirectorChange={(v) => setParam('director', v)}
                  directors={[]} // v0.28.0: режиссёры теперь в AnimeManifest (IPFS)
                  episodesMin={episodesMin}
                  onEpisodesMinChange={(v) => setParam('episodesMin', v)}
                  episodesMax={episodesMax}
                  onEpisodesMaxChange={(v) => setParam('episodesMax', v)}
                  onEpisodesRangeClear={() => setParams({ episodesMin: '', episodesMax: '' })}
                  // Фильтры качества
                  resolution={resolution}
                  onResolutionChange={(v) => setParam('resolution', v)}
                  bitDepth={bitDepth}
                  onBitDepthChange={(v) => setParam('bitDepth', v)}
                  onQualityClear={() => setParams({ resolution: '', bitDepth: '' })}
                  // Сортировка
                  sortBy={sortBy}
                  onSortChange={(v) => setParam('sortBy', v)}
                  // Статус просмотра
                  watchStatus={watchStatusFilter}
                  onWatchStatusChange={(v) => setParam('watchStatus', v)}
                  onReset={handleReset}
                  // Количество результатов для mobile
                  resultCount={animes.length}
                  // Faceted counts
                  counts={filterCounts}
                  isLoadingCounts={isLoadingCounts}
                />
              </Box>

              {/* Переключатель режима отображения */}
              <SegmentGroup.Root value={viewMode} onValueChange={handleViewModeChange} size="sm">
                <SegmentGroup.Indicator />
                <SegmentGroup.Item value="individual">
                  <SegmentGroup.ItemText>
                    <HStack gap={1}>
                      <Icon as={LuGrid2X2} boxSize={4} />
                      <Text>По отдельности</Text>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
                <SegmentGroup.Item value="franchise">
                  <SegmentGroup.ItemText>
                    <HStack gap={1}>
                      <Icon as={LuLayers} boxSize={4} />
                      <Text>По франшизам</Text>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </SegmentGroup.Root>
            </HStack>

            {/* Сетка аниме — зависит от режима отображения */}
            {isEmptyWithoutFilters
              ? <EmptyLibraryState onImport={() => setIsImportOpen(true)} />
              : viewMode === 'individual'
              ? (
                <AnimeGrid
                  animes={animes}
                  isLoading={isLoading}
                  onPlay={handleCardPlay}
                  onExport={handleCardExport}
                  onRefreshMetadata={handleCardRefreshMetadata}
                  onDelete={handleCardDelete}
                  onWatchStatusChange={handleWatchStatusChange}
                />
              )
              : (
                <FranchiseView
                  franchiseGroups={franchiseGroups}
                  standAloneAnimes={standAloneAnimes}
                  isLoading={isLoading}
                  onPlay={handleCardPlay}
                  onExport={handleCardExport}
                  onRefreshMetadata={handleCardRefreshMetadata}
                  onDelete={handleCardDelete}
                  onWatchStatusChange={handleWatchStatusChange}
                />
              )}
          </VStack>
        </Box>

        {/* Визард импорта видео */}
        <ImportWizardDialog
          open={isImportOpen}
          onOpenChange={handleImportOpenChange}
          initialFolderPath={droppedFolderPath}
        />

        {/* Диалог удаления аниме */}
        {selectedAnime && (
          <DeleteAnimeDialog
            open={isDeleteDialogOpen}
            onOpenChange={(open) => {
              setIsDeleteDialogOpen(open)
              if (!open) setSelectedAnimeId(null)
            }}
            anime={{
              id: selectedAnime.id,
              name: selectedAnime.name,
              episodeCount: selectedAnime.episodeCount,
            }}
            onDeleted={() => {
              setSelectedAnimeId(null)
              refetch()
            }}
          />
        )}
      </Box>
    </DropZone>
  )
}

/**
 * Страница библиотеки аниме с Suspense boundary
 */
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <Box minH="100vh" bg="bg" color="fg" display="flex" alignItems="center" justifyContent="center">
          <VStack gap={4}>
            <Spinner size="xl" color="purple.500" />
            <Text color="fg.muted">Загрузка библиотеки...</Text>
          </VStack>
        </Box>
      }
    >
      <LibraryPageContent />
    </Suspense>
  )
}
