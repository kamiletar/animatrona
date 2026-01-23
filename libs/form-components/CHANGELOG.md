# Changelog

Все значимые изменения в библиотеке @lena/form-components документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [0.54.1] - 2026-01-05

### Fixed

- `FieldNumber`: для опциональных полей не передаём min/max в NumberInput когда значение пустое — убрана красная рамка для пустых опциональных полей

## [0.54.0] - 2026-01-03

### Added

- `form-from-schema.spec.tsx` — unit тесты для `FormFromSchema` (~15 тестов)
- `form-with-api.spec.tsx` — unit тесты для `FormWithApi` (~12 тестов)
- Покрытие тестами всех критичных компонентов схемогенерации

### Changed

- Deprecated type aliases централизованы в `form-fields/index.ts`
- Удалены локальные deprecated экспорты из 7 selection компонентов
- `field-select.tsx` использует `BaseOption<string | number>[]` вместо `SelectOption`

### Improved

- Общее покрытие тестами: +27 unit тестов
- Обратная совместимость сохранена через централизованный реэкспорт deprecated типов

## [0.53.0] - 2025-12-31

### Added

- Оптимизация производительности форм
- Улучшенная мемоизация в form-fields

## [0.51.0] - 2025-12-24

### Added

- `useAsyncSearch` — общий хук для async поиска с debounce (Combobox, Autocomplete)
- `AsyncQueryFn`, `AsyncQueryResult` — типы для async запросов
- Persistence TTL — опция `ttl` для времени жизни черновика
- `ClearDraftButton` — компонент кнопки очистки черновика
- `savedAt` — timestamp сохранения черновика в `FormPersistenceResult`

### Changed

- `FieldCombobox` и `FieldAutocomplete` используют `useAsyncSearch` вместо дублирования логики
- `useFormPersistence` теперь сохраняет данные в новом формате с метаданными (version, savedAt)
- Обратная совместимость со старым форматом сохранённых данных

## [0.50.0] - 2025-12-24

### Added

- `SelectionFieldLabel` — общий компонент для label+tooltip в selection полях
- `useGroupedOptions` — хук группировки опций (Combobox, Listbox, Select)
- `getOptionLabel` — утилита для получения label опции
- `zod-utils.ts` — централизованные функции `unwrapSchema`, `unwrapSchemaWithRequired`
- `LinkPopover` — модальное окно для ввода URL вместо `window.prompt()`
- Защита от циклических схем в `schema-traversal` (WeakSet + MAX_DEPTH=20)
- `SWITCH_STYLES` константы в `field-schedule.tsx`

### Changed

- `extractConstraints` рефакторинг с generic handler pattern
- `FormSteps` декомпозиция на хуки: `useStepState`, `useStepPersistence`, `useStepNavigation`
- Selection поля используют общие компоненты вместо дублирования

### Fixed

- `field-rich-text`: добавлен try/catch для JSON.parse

### Removed

- ~500 строк дублирующегося кода

## [0.49.0] и ранее

История изменений до v0.50.0 не документировалась.
