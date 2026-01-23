-- Добавление полей для графа франшизы из REST API Shikimori

-- rootShikimoriId — минимальный shikimoriId из графа, стабильный ключ франшизы
ALTER TABLE "Franchise" ADD COLUMN "rootShikimoriId" INTEGER;

-- graphJson — полный граф франшизы в JSON формате (nodes + links)
ALTER TABLE "Franchise" ADD COLUMN "graphJson" TEXT;

-- graphUpdatedAt — когда граф был обновлён (для автообновления раз в неделю)
ALTER TABLE "Franchise" ADD COLUMN "graphUpdatedAt" DATETIME;

-- Индекс для быстрого поиска по rootShikimoriId
CREATE UNIQUE INDEX "Franchise_rootShikimoriId_key" ON "Franchise"("rootShikimoriId");
