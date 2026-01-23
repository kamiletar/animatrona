-- Добавляем недостающие поля в Anime
-- Сгенерировано через: prisma migrate diff --from-migrations --to-schema-datamodel

-- AlterTable Anime
ALTER TABLE "Anime" ADD COLUMN "ageRating" TEXT;
ALTER TABLE "Anime" ADD COLUMN "duration" INTEGER;
ALTER TABLE "Anime" ADD COLUMN "licensor" TEXT;
ALTER TABLE "Anime" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "Anime" ADD COLUMN "source" TEXT;

-- AlterTable Genre
ALTER TABLE "Genre" ADD COLUMN "shikimoriId" INTEGER;

-- CreateTable Theme
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameRu" TEXT,
    "shikimoriId" INTEGER
);

-- CreateTable ThemeOnAnime
CREATE TABLE "ThemeOnAnime" (
    "animeId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "themeId"),
    CONSTRAINT "ThemeOnAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThemeOnAnime_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");
CREATE UNIQUE INDEX "Theme_shikimoriId_key" ON "Theme"("shikimoriId");
CREATE INDEX "Theme_name_idx" ON "Theme"("name");
CREATE UNIQUE INDEX "Genre_shikimoriId_key" ON "Genre"("shikimoriId");

-- NOTE: FTS5 таблицы (anime_fts, anime_fts_*) НЕ удаляются
-- Prisma не понимает виртуальные FTS5 таблицы, но они нужны для полнотекстового поиска
