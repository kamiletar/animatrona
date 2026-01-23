# Field компоненты

40 типов полей для декларативных форм.

## Текстовые поля

| Компонент                     | Описание                   |
| ----------------------------- | -------------------------- |
| `Form.Field.String`           | Текстовое поле             |
| `Form.Field.Textarea`         | Многострочный текст        |
| `Form.Field.Password`         | Пароль с toggle visibility |
| `Form.Field.PasswordStrength` | Пароль с индикатором силы  |
| `Form.Field.Editable`         | Inline редактирование      |
| `Form.Field.RichText`         | WYSIWYG редактор (Tiptap)  |

## Числовые поля

| Компонент                | Описание                        |
| ------------------------ | ------------------------------- |
| `Form.Field.Number`      | Простое числовое поле           |
| `Form.Field.NumberInput` | Числовое поле со стрелками      |
| `Form.Field.Slider`      | Ползунок для диапазонов         |
| `Form.Field.Rating`      | Рейтинг звёздами                |
| `Form.Field.Currency`    | Денежное поле с форматированием |
| `Form.Field.Percentage`  | Процентное поле                 |

## Дата и время

| Компонент                   | Описание                       |
| --------------------------- | ------------------------------ |
| `Form.Field.Date`           | Поле даты                      |
| `Form.Field.Time`           | Поле времени                   |
| `Form.Field.DateRange`      | Диапазон дат с пресетами       |
| `Form.Field.DateTimePicker` | Дата и время вместе            |
| `Form.Field.Duration`       | Длительность (HH:MM)           |
| `Form.Field.Schedule`       | Редактор недельного расписания |

## Выбор из списка

| Компонент                    | Описание                          |
| ---------------------------- | --------------------------------- |
| `Form.Field.Select`          | Стилизованный Select              |
| `Form.Field.NativeSelect`    | Нативный браузерный Select        |
| `Form.Field.CascadingSelect` | Каскадный select (страна → город) |
| `Form.Field.Combobox`        | Searchable select с группами      |
| `Form.Field.Autocomplete`    | Текстовое поле с подсказками      |
| `Form.Field.Listbox`         | Listbox single/multi selection    |
| `Form.Field.RadioGroup`      | Группа радиокнопок                |
| `Form.Field.RadioCard`       | Card-based radio selection        |
| `Form.Field.SegmentedGroup`  | Segmented control                 |

## Множественный выбор

| Компонент                 | Описание                   |
| ------------------------- | -------------------------- |
| `Form.Field.Checkbox`     | Чекбокс                    |
| `Form.Field.CheckboxCard` | Card-based multi selection |
| `Form.Field.Switch`       | Переключатель              |
| `Form.Field.Tags`         | Ввод тегов                 |

## Специализированные

| Компонент                | Описание                          |
| ------------------------ | --------------------------------- |
| `Form.Field.Auto`        | Автоопределение типа из Zod схемы |
| `Form.Field.PinInput`    | Ввод PIN/OTP кода                 |
| `Form.Field.OTPInput`    | OTP код с таймером resend         |
| `Form.Field.ColorPicker` | Выбор цвета                       |
| `Form.Field.FileUpload`  | Загрузка файлов                   |
| `Form.Field.Phone`       | Телефон с маской                  |
| `Form.Field.MaskedInput` | Универсальная маска               |
| `Form.Field.Address`     | Адрес с автодополнением (DaData)  |

---

## Form.Field.RichText — WYSIWYG редактор (v0.51.0+)

WYSIWYG редактор на базе Tiptap с опциональной загрузкой изображений:

```tsx
// Базовое использование (без изображений)
<Form.Field.RichText name="content" label="Контент" />

// С загрузкой изображений
<Form.Field.RichText
  name="content"
  label="Контент"
  imageUpload={{
    endpoint: '/api/upload',      // URL endpoint для загрузки
    category: 'CONTENT',          // Категория изображения (опционально)
    maxSize: 10 * 1024 * 1024,    // Максимум 10MB (по умолчанию)
  }}
  toolbarButtons={['bold', 'italic', 'link', 'image']}
/>
```

**Props:**

| Prop             | Тип                 | Default         | Описание                          |
| ---------------- | ------------------- | --------------- | --------------------------------- |
| `minHeight`      | `string \| number`  | `'150px'`       | Минимальная высота редактора      |
| `maxHeight`      | `string \| number`  | -               | Максимальная высота (со скроллом) |
| `showToolbar`    | `boolean`           | `true`          | Показывать панель инструментов    |
| `toolbarButtons` | `ToolbarButton[]`   | все кроме image | Кнопки в панели                   |
| `outputFormat`   | `'html' \| 'json'`  | `'html'`        | Формат вывода                     |
| `imageUpload`    | `ImageUploadConfig` | -               | Конфигурация загрузки изображений |

**ImageUploadConfig:**

```typescript
interface ImageUploadConfig {
  endpoint: string // URL endpoint для загрузки (обязателен)
  category?: string // Категория изображения
  maxSize?: number // Максимальный размер в байтах (по умолчанию 10MB)
  acceptTypes?: string[] // Разрешённые типы (по умолчанию ['image/*'])
}
```

**Доступные кнопки тулбара:**

`bold`, `italic`, `underline`, `strike`, `code`, `heading1`, `heading2`, `heading3`, `bulletList`, `orderedList`, `blockquote`, `link`, `image`, `undo`, `redo`

---

## Form.Field.Auto — Автоопределение типа (v0.43.0+)

Автоматически выбирает компонент поля на основе типа в Zod схеме:

```tsx
const Schema = z.object({
  firstName: z.string(),      // → FieldString
  age: z.number(),            // → FieldNumber
  isActive: z.boolean(),      // → FieldCheckbox
  role: z.enum(['user', 'admin']), // → FieldNativeSelect
  createdAt: z.date(),        // → FieldDate
})

<Form schema={Schema} initialValue={data} onSubmit={save}>
  <Form.Field.Auto name="firstName" />
  <Form.Field.Auto name="age" />
  <Form.Field.Auto name="isActive" />
  <Form.Field.Auto name="role" />
  <Form.Field.Auto name="createdAt" />
</Form>
```

**Маппинг типов:**

| Zod тип                  | Компонент         |
| ------------------------ | ----------------- |
| `z.string()`             | FieldString       |
| `z.number()` / `z.int()` | FieldNumber       |
| `z.boolean()`            | FieldCheckbox     |
| `z.date()`               | FieldDate         |
| `z.enum([...])`          | FieldNativeSelect |

**Auto-label:** Если label не указан, генерируется из имени поля: `"firstName"` → `"First Name"`.

---

## Form.Field.CascadingSelect — Каскадный выбор (v0.42.0+)

Загружает опции динамически на основе значения другого поля:

```tsx
<Form.Field.Select
  name="country"
  label="Страна"
  options={countries}
/>

<Form.Field.CascadingSelect
  name="city"
  label="Город"
  dependsOn="country"
  loadOptions={async (countryCode) => {
    if (!countryCode) return []
    const cities = await fetchCities(countryCode)
    return cities.map(c => ({ label: c.name, value: c.id }))
  }}
  placeholderWhenDisabled="Сначала выберите страну"
  clearOnParentChange
  disableWhenParentEmpty
/>
```

**Props:**

- `dependsOn` — имя родительского поля
- `loadOptions` — функция загрузки опций
- `clearOnParentChange` — очищать значение при изменении родителя (по умолчанию `true`)
- `disableWhenParentEmpty` — блокировать при пустом родителе (по умолчанию `true`)
- `placeholderWhenDisabled` — placeholder для заблокированного состояния
- `initialOptions` — начальные опции до загрузки

---

## RadioCard с keyboard navigation (v0.32.0+)

```tsx
<Form.Field.RadioCard
  name="role"
  keyboardNavigation // Включить стрелки с cycling
  options={[
    { value: 'student', label: 'Ученик' },
    { value: 'instructor', label: 'Инструктор' },
  ]}
/>
```

При включённом `keyboardNavigation` стрелки влево/вправо циклически переключают опции.

---

## Связанные документы

- [README.md](../README.md) — обзор библиотеки
- [form-level.md](./form-level.md) — Form-level компоненты
