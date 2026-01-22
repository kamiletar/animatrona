-- FTS5 Full-Text Search для аниме
-- Создаём виртуальную таблицу с полнотекстовым индексом

CREATE VIRTUAL TABLE IF NOT EXISTS anime_fts USING fts5(
  id UNINDEXED,           -- Не индексировать, только для связи с Anime
  name,                   -- Русское название
  originalName,           -- Оригинальное название (японское/английское)
  description,            -- Описание
  tokenize='unicode61 remove_diacritics 2'  -- Unicode токенизация с нормализацией
);

-- Наполнить существующими данными
INSERT INTO anime_fts(id, name, originalName, description)
SELECT id, name, COALESCE(originalName, ''), COALESCE(description, '')
FROM Anime;

-- Триггер: INSERT в Anime → INSERT в anime_fts
CREATE TRIGGER anime_fts_insert AFTER INSERT ON Anime BEGIN
  INSERT INTO anime_fts(id, name, originalName, description)
  VALUES (new.id, new.name, COALESCE(new.originalName, ''), COALESCE(new.description, ''));
END;

-- Триггер: UPDATE в Anime → UPDATE в anime_fts
CREATE TRIGGER anime_fts_update AFTER UPDATE ON Anime BEGIN
  UPDATE anime_fts SET
    name = new.name,
    originalName = COALESCE(new.originalName, ''),
    description = COALESCE(new.description, '')
  WHERE id = new.id;
END;

-- Триггер: DELETE в Anime → DELETE в anime_fts
CREATE TRIGGER anime_fts_delete AFTER DELETE ON Anime BEGIN
  DELETE FROM anime_fts WHERE id = old.id;
END;
