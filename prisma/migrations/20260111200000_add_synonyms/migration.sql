-- Добавляем поле synonyms в таблицу Anime
-- Хранит JSON массив альтернативных названий с Shikimori

ALTER TABLE Anime ADD COLUMN synonyms TEXT;

-- Обновляем FTS индекс: добавляем колонку synonyms
-- FTS5 не поддерживает ALTER TABLE, поэтому пересоздаём таблицу

-- 1. Удаляем триггеры
DROP TRIGGER IF EXISTS anime_fts_insert;
DROP TRIGGER IF EXISTS anime_fts_update;
DROP TRIGGER IF EXISTS anime_fts_delete;

-- 2. Сохраняем данные и удаляем старую FTS таблицу
DROP TABLE IF EXISTS anime_fts;

-- 3. Создаём новую FTS таблицу с synonyms
CREATE VIRTUAL TABLE IF NOT EXISTS anime_fts USING fts5(
  id UNINDEXED,           -- Не индексировать, только для связи с Anime
  name,                   -- Русское название
  originalName,           -- Оригинальное название (японское/английское)
  synonyms,               -- Альтернативные названия (JSON array → space-separated)
  description,            -- Описание
  tokenize='unicode61 remove_diacritics 2'  -- Unicode токенизация с нормализацией
);

-- 4. Наполнить существующими данными
-- synonyms хранится как JSON массив, преобразуем в строку через replace
INSERT INTO anime_fts(id, name, originalName, synonyms, description)
SELECT
  id,
  name,
  COALESCE(originalName, ''),
  COALESCE(REPLACE(REPLACE(REPLACE(synonyms, '["', ''), '"]', ''), '","', ' '), ''),
  COALESCE(description, '')
FROM Anime;

-- 5. Создаём новые триггеры

-- Триггер: INSERT в Anime → INSERT в anime_fts
CREATE TRIGGER anime_fts_insert AFTER INSERT ON Anime BEGIN
  INSERT INTO anime_fts(id, name, originalName, synonyms, description)
  VALUES (
    new.id,
    new.name,
    COALESCE(new.originalName, ''),
    COALESCE(REPLACE(REPLACE(REPLACE(new.synonyms, '["', ''), '"]', ''), '","', ' '), ''),
    COALESCE(new.description, '')
  );
END;

-- Триггер: UPDATE в Anime → UPDATE в anime_fts
CREATE TRIGGER anime_fts_update AFTER UPDATE ON Anime BEGIN
  UPDATE anime_fts SET
    name = new.name,
    originalName = COALESCE(new.originalName, ''),
    synonyms = COALESCE(REPLACE(REPLACE(REPLACE(new.synonyms, '["', ''), '"]', ''), '","', ' '), ''),
    description = COALESCE(new.description, '')
  WHERE id = new.id;
END;

-- Триггер: DELETE в Anime → DELETE в anime_fts
CREATE TRIGGER anime_fts_delete AFTER DELETE ON Anime BEGIN
  DELETE FROM anime_fts WHERE id = old.id;
END;
