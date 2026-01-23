-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataURL" TEXT,
    "category" TEXT NOT NULL,
    "source" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shikimoriFranchiseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "posterId" TEXT,
    "rating" REAL,
    "folderPath" TEXT,
    "isBdRemux" BOOLEAN NOT NULL DEFAULT false,
    "shikimoriId" INTEGER,
    "franchiseId" TEXT,
    "nextEpisodeAt" DATETIME,
    "lastSelectedAudioDubGroup" TEXT,
    "lastSelectedAudioLanguage" TEXT,
    "lastSelectedSubtitleDubGroup" TEXT,
    "lastSelectedSubtitleLanguage" TEXT,
    "relationsCheckedAt" DATETIME,
    "watchStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "watchedAt" DATETIME,
    "userRating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Anime_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Anime_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shikimoriId" INTEGER,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StudioOnAnime" (
    "animeId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "studioId"),
    CONSTRAINT "StudioOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioOnAnime_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameRu" TEXT,
    "shikimoriId" INTEGER,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PersonOnAnime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleText" TEXT,
    CONSTRAINT "PersonOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonOnAnime_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameRu" TEXT,
    "shikimoriId" INTEGER,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CharacterOnAnime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "roleText" TEXT,
    CONSTRAINT "CharacterOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterOnAnime_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterVoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "animeId" TEXT,
    CONSTRAINT "CharacterVoice_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterVoice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "shikimoriId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalLink_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "shikimoriId" INTEGER,
    "name" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "playerUrl" TEXT,
    "imageUrl" TEXT,
    "hosting" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Video_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fandubber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FandubberOnAnime" (
    "animeId" TEXT NOT NULL,
    "fandubberId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "fandubberId"),
    CONSTRAINT "FandubberOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FandubberOnAnime_fandubberId_fkey" FOREIGN KEY ("fandubberId") REFERENCES "Fandubber" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fansubber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FansubberOnAnime" (
    "animeId" TEXT NOT NULL,
    "fansubberId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "fansubberId"),
    CONSTRAINT "FansubberOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FansubberOnAnime_fansubberId_fkey" FOREIGN KEY ("fansubberId") REFERENCES "Fansubber" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenreOnAnime" (
    "animeId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "genreId"),
    CONSTRAINT "GenreOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GenreOnAnime_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceAnimeId" TEXT NOT NULL,
    "targetShikimoriId" INTEGER NOT NULL,
    "targetAnimeId" TEXT,
    "relationKind" TEXT NOT NULL,
    "targetName" TEXT,
    "targetPosterUrl" TEXT,
    "targetYear" INTEGER,
    "targetKind" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnimeRelation_sourceAnimeId_fkey" FOREIGN KEY ("sourceAnimeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeRelation_targetAnimeId_fkey" FOREIGN KEY ("targetAnimeId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TV',
    "year" INTEGER,
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "folderPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Season_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "streamIndex" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'und',
    "title" TEXT,
    "dubGroup" TEXT,
    "codec" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "bitrate" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "extractedPath" TEXT,
    "transcodedPath" TEXT,
    "transcodeStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "transcodeError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioTrack_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtitleTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "streamIndex" INTEGER NOT NULL DEFAULT -1,
    "language" TEXT NOT NULL DEFAULT 'und',
    "title" TEXT,
    "dubGroup" TEXT,
    "format" TEXT NOT NULL,
    "filePath" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubtitleTrack_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtitleFont" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subtitleTrackId" TEXT NOT NULL,
    "fontName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubtitleFont_subtitleTrackId_fkey" FOREIGN KEY ("subtitleTrackId") REFERENCES "SubtitleTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CHAPTER',
    "skippable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chapter_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "seasonId" TEXT,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "durationMs" INTEGER,
    "sourcePath" TEXT,
    "transcodedPath" TEXT,
    "manifestPath" TEXT,
    "extractedVideoPath" TEXT,
    "transcodeStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "transcodeError" TEXT,
    "videoCodec" TEXT,
    "videoWidth" INTEGER,
    "videoHeight" INTEGER,
    "videoBitrate" INTEGER,
    "videoBitDepth" INTEGER,
    "thumbnailPaths" TEXT,
    "screenshotPaths" TEXT,
    "encodingSettingsJson" TEXT,
    "encodingProfileId" TEXT,
    "sourceSize" BIGINT,
    "transcodedSize" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Episode_encodingProfileId_fkey" FOREIGN KEY ("encodingProfileId") REFERENCES "EncodingProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "currentTime" REAL NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "selectedAudioTrackId" TEXT,
    "selectedSubtitleTrackId" TEXT,
    "volume" REAL NOT NULL DEFAULT 1,
    "lastWatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchProgress_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "useGpu" BOOLEAN NOT NULL DEFAULT true,
    "videoCodec" TEXT NOT NULL DEFAULT 'AV1',
    "videoQuality" INTEGER NOT NULL DEFAULT 24,
    "videoPreset" TEXT NOT NULL DEFAULT 'p5',
    "audioBitrate" INTEGER NOT NULL DEFAULT 256,
    "libraryPath" TEXT,
    "outputPath" TEXT,
    "minimizeToTray" BOOLEAN NOT NULL DEFAULT true,
    "closeToTray" BOOLEAN NOT NULL DEFAULT true,
    "showTrayNotification" BOOLEAN NOT NULL DEFAULT true,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "skipOpening" BOOLEAN NOT NULL DEFAULT false,
    "skipEnding" BOOLEAN NOT NULL DEFAULT false,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "trackPreference" TEXT NOT NULL DEFAULT 'AUTO',
    "defaultProfileId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_defaultProfileId_fkey" FOREIGN KEY ("defaultProfileId") REFERENCES "EncodingProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncodingProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "codec" TEXT NOT NULL DEFAULT 'AV1',
    "useGpu" BOOLEAN NOT NULL DEFAULT true,
    "rateControl" TEXT NOT NULL DEFAULT 'VBR',
    "cq" INTEGER NOT NULL DEFAULT 28,
    "maxBitrate" INTEGER,
    "preset" TEXT NOT NULL DEFAULT 'p5',
    "tune" TEXT NOT NULL DEFAULT 'HQ',
    "multipass" TEXT NOT NULL DEFAULT 'DISABLED',
    "spatialAq" BOOLEAN NOT NULL DEFAULT true,
    "temporalAq" BOOLEAN NOT NULL DEFAULT true,
    "aqStrength" INTEGER NOT NULL DEFAULT 8,
    "lookahead" INTEGER,
    "lookaheadLevel" INTEGER,
    "gopSize" INTEGER NOT NULL DEFAULT 240,
    "bRefMode" TEXT NOT NULL DEFAULT 'DISABLED',
    "force10Bit" BOOLEAN NOT NULL DEFAULT false,
    "temporalFilter" BOOLEAN NOT NULL DEFAULT false,
    "preferCpu" BOOLEAN NOT NULL DEFAULT false,
    "deband" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "dataJson" TEXT NOT NULL,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentFileName" TEXT,
    "createdAnimeId" TEXT,
    "createdAnimeFolder" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "File_path_key" ON "File"("path");

-- CreateIndex
CREATE INDEX "File_category_idx" ON "File"("category");

-- CreateIndex
CREATE INDEX "File_uploadedAt_idx" ON "File"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_shikimoriFranchiseId_key" ON "Franchise"("shikimoriFranchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_shikimoriId_key" ON "Anime"("shikimoriId");

-- CreateIndex
CREATE INDEX "Anime_name_idx" ON "Anime"("name");

-- CreateIndex
CREATE INDEX "Anime_year_idx" ON "Anime"("year");

-- CreateIndex
CREATE INDEX "Anime_status_idx" ON "Anime"("status");

-- CreateIndex
CREATE INDEX "Anime_shikimoriId_idx" ON "Anime"("shikimoriId");

-- CreateIndex
CREATE INDEX "Anime_franchiseId_idx" ON "Anime"("franchiseId");

-- CreateIndex
CREATE INDEX "Anime_watchStatus_idx" ON "Anime"("watchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_name_key" ON "Studio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_shikimoriId_key" ON "Studio"("shikimoriId");

-- CreateIndex
CREATE INDEX "Studio_name_idx" ON "Studio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Person_shikimoriId_key" ON "Person"("shikimoriId");

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Person_nameRu_idx" ON "Person"("nameRu");

-- CreateIndex
CREATE INDEX "PersonOnAnime_animeId_idx" ON "PersonOnAnime"("animeId");

-- CreateIndex
CREATE INDEX "PersonOnAnime_personId_idx" ON "PersonOnAnime"("personId");

-- CreateIndex
CREATE INDEX "PersonOnAnime_role_idx" ON "PersonOnAnime"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PersonOnAnime_animeId_personId_role_key" ON "PersonOnAnime"("animeId", "personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Character_shikimoriId_key" ON "Character"("shikimoriId");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_nameRu_idx" ON "Character"("nameRu");

-- CreateIndex
CREATE INDEX "CharacterOnAnime_animeId_idx" ON "CharacterOnAnime"("animeId");

-- CreateIndex
CREATE INDEX "CharacterOnAnime_characterId_idx" ON "CharacterOnAnime"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterOnAnime_animeId_characterId_key" ON "CharacterOnAnime"("animeId", "characterId");

-- CreateIndex
CREATE INDEX "CharacterVoice_characterId_idx" ON "CharacterVoice"("characterId");

-- CreateIndex
CREATE INDEX "CharacterVoice_personId_idx" ON "CharacterVoice"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterVoice_characterId_personId_animeId_key" ON "CharacterVoice"("characterId", "personId", "animeId");

-- CreateIndex
CREATE INDEX "ExternalLink_animeId_idx" ON "ExternalLink"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLink_animeId_kind_key" ON "ExternalLink"("animeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Video_shikimoriId_key" ON "Video"("shikimoriId");

-- CreateIndex
CREATE INDEX "Video_animeId_idx" ON "Video"("animeId");

-- CreateIndex
CREATE INDEX "Video_kind_idx" ON "Video"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Fandubber_name_key" ON "Fandubber"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Fansubber_name_key" ON "Fansubber"("name");

-- CreateIndex
CREATE INDEX "AnimeRelation_sourceAnimeId_idx" ON "AnimeRelation"("sourceAnimeId");

-- CreateIndex
CREATE INDEX "AnimeRelation_targetAnimeId_idx" ON "AnimeRelation"("targetAnimeId");

-- CreateIndex
CREATE INDEX "AnimeRelation_targetShikimoriId_idx" ON "AnimeRelation"("targetShikimoriId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRelation_sourceAnimeId_targetShikimoriId_key" ON "AnimeRelation"("sourceAnimeId", "targetShikimoriId");

-- CreateIndex
CREATE INDEX "Season_animeId_idx" ON "Season"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_animeId_number_key" ON "Season"("animeId", "number");

-- CreateIndex
CREATE INDEX "AudioTrack_episodeId_idx" ON "AudioTrack"("episodeId");

-- CreateIndex
CREATE INDEX "SubtitleTrack_episodeId_idx" ON "SubtitleTrack"("episodeId");

-- CreateIndex
CREATE INDEX "SubtitleFont_subtitleTrackId_idx" ON "SubtitleFont"("subtitleTrackId");

-- CreateIndex
CREATE INDEX "Chapter_episodeId_idx" ON "Chapter"("episodeId");

-- CreateIndex
CREATE INDEX "Chapter_type_idx" ON "Chapter"("type");

-- CreateIndex
CREATE INDEX "Episode_animeId_idx" ON "Episode"("animeId");

-- CreateIndex
CREATE INDEX "Episode_seasonId_idx" ON "Episode"("seasonId");

-- CreateIndex
CREATE INDEX "Episode_transcodeStatus_idx" ON "Episode"("transcodeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_animeId_number_key" ON "Episode"("animeId", "number");

-- CreateIndex
CREATE INDEX "WatchProgress_animeId_idx" ON "WatchProgress"("animeId");

-- CreateIndex
CREATE INDEX "WatchProgress_lastWatchedAt_idx" ON "WatchProgress"("lastWatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_animeId_episodeId_key" ON "WatchProgress"("animeId", "episodeId");

-- CreateIndex
CREATE INDEX "EncodingProfile_isBuiltIn_idx" ON "EncodingProfile"("isBuiltIn");

-- CreateIndex
CREATE INDEX "EncodingProfile_isDefault_idx" ON "EncodingProfile"("isDefault");

-- CreateIndex
CREATE INDEX "ImportQueueItem_status_idx" ON "ImportQueueItem"("status");

-- CreateIndex
CREATE INDEX "ImportQueueItem_priority_idx" ON "ImportQueueItem"("priority");

-- CreateIndex
CREATE INDEX "ImportQueueItem_addedAt_idx" ON "ImportQueueItem"("addedAt");
