# API Reference

Хуки, контексты, типы и утилиты @lena/form-components.

---

## Хуки форм

### useAppForm

Основной хук для создания формы (обёртка над TanStack Form):

```tsx
import { useAppForm } from '@lena/form-components'
import { z } from 'zod/v4'

const Schema = z.object({
  email: z.email(),
  name: z.string().min(2),
})

const form = useAppForm({
  defaultValues: { email: '', name: '' },
  validators: { onChange: Schema },
  onSubmit: async ({ value }) => {
    await saveUser(value)
  },
})
```

### useFieldActions (v0.32.0+)

Императивные действия с полями:

```tsx
import { useFieldActions } from '@lena/form-components'

const { value, onChange, setError, clearError } = useFieldActions('city')

const handleDetect = async () => {
  const location = await detectLocation()
  if (location.error) {
    setError(location.error)
  } else {
    onChange(location.city)
  }
}
```

---

## Хуки контекстов

```typescript
// Доступ к field API внутри кастомных компонентов
const field = useFieldContext<string>()

// Доступ к form API
const form = useFormContext()

// Контекст именования группы
const group = useFormGroup() // { originalName, name }

// Контекст именования поля
const field = useFormField() // { originalName, name }

// TanStack Form field с именованием
const ctx = useTanStackFormField() // { originalName, name, field }

// Операции с массивом
const list = useFormGroupList() // { pushValue, removeValue, ... }

// Контекст элемента массива
const item = useFormGroupListItem() // { index, remove, moveUp, moveDown, ... }
```

---

## Хуки Steps (v0.32.0+)

### useFormStepsContext

Программное управление шагами:

```tsx
import { useFormStepsContext } from '@lena/form-components'

function CustomNavigation() {
  const { goToNext, goToPrev, skipToEnd, triggerSubmit, clearStepPersistence } = useFormStepsContext()

  return <Button onClick={() => skipToEnd()}>Пропустить всё</Button>
}
```

---

## i18n (v0.52.0+)

### FormI18nProvider

Провайдер для интернационализации форм:

```tsx
import { FormI18nProvider } from '@lena/form-components'
import { useTranslations, useLocale } from 'next-intl'

function App({ children }) {
  const t = useTranslations('forms')
  const locale = useLocale()

  return (
    <FormI18nProvider t={t} locale={locale}>
      {children}
    </FormI18nProvider>
  )
}
```

### useFormI18n

Доступ к i18n контексту:

```tsx
import { useFormI18n } from '@lena/form-components'

function CustomField() {
  const i18n = useFormI18n()

  if (i18n) {
    const label = i18n.t('Product.name.title')
    const locale = i18n.locale
  }
}
```

### getLocalizedValue

Утилита для получения локализованного значения:

```tsx
import { getLocalizedValue, useFormI18n } from '@lena/form-components'

function CustomField({ label, i18nKey }) {
  const i18n = useFormI18n()
  const resolvedLabel = getLocalizedValue(i18n, i18nKey, 'title', label)
  // resolvedLabel = перевод или fallback
}
```

**Приоритет значений:**

1. Props компонента (высший)
2. i18n перевод (если FormI18nProvider есть)
3. Значение из schema meta (fallback)

---

## Хуки оффлайн

```typescript
import { useOfflineStatus, useSyncQueue } from '@lena/form-components/offline'

// Проверка статуса сети
const isOffline = useOfflineStatus()

// Работа с очередью синхронизации
const { pendingCount, isProcessing } = useSyncQueue()
```

### useOfflineForm

Высокоуровневый хук для форм с оффлайн поддержкой:

```tsx
import { useOfflineForm } from '@lena/form-components/offline'

const { submit, isOffline, pendingCount, isProcessing } = useOfflineForm({
  actionType: 'UPDATE_PROFILE',
  onlineSubmit: async (value) => await updateProfile(value),
  onSuccess: () => toast.success('Сохранено'),
  onQueued: () => toast.info('Сохранено локально'),
})
```

---

## Хуки relation полей

```tsx
import { useRelationOptions, useRelationFieldContext } from '@lena/form-components'

function CustomCategorySelect() {
  // Получить options для конкретной модели
  const { options, isLoading, error } = useRelationOptions('Category')

  // Или полный контекст
  const context = useRelationFieldContext()
  const categoryState = context?.getState('Category')

  return <Select options={options} isLoading={isLoading} />
}
```

---

## Типы

### BaseFieldProps

Базовые пропсы для field компонентов:

```typescript
interface BaseFieldProps {
  label?: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
}
```

### Реэкспорты из TanStack Form

```typescript
type { FieldApi, FormApi, DeepKeys, DeepValue }
```

### ValidateOn

Режимы валидации:

```typescript
type ValidateOn = 'change' | 'blur' | 'submit' | 'mount'
```

### FormMiddleware

Перехватчики событий формы:

```typescript
interface FormMiddleware<TData> {
  beforeSubmit?: (data: TData) => TData | undefined | Promise<TData | undefined>
  afterSuccess?: (data: TData) => void
  onError?: (error: Error) => void
}
```

### FormPersistenceConfig

Конфигурация localStorage persistence:

```typescript
interface FormPersistenceConfig {
  key: string
  debounceMs?: number
  dialogTitle?: string
  dialogDescription?: string
  restoreButtonText?: string
  discardButtonText?: string
}
```

### FormOfflineConfig

Конфигурация оффлайн режима:

```typescript
interface FormOfflineConfig {
  actionType: SyncActionType
  storageKey?: string
  onQueued?: () => void
  onSynced?: () => void
  onSyncError?: (error: Error) => void
}
```

### RelationConfig

Конфигурация relation поля:

```typescript
interface RelationConfig {
  model: string
  useQuery: () => { data: any[]; isLoading: boolean; error?: Error }
  labelField: string
  valueField?: string // default: 'id'
  descriptionField?: string
  queryArgs?: { where?: object; orderBy?: object }
}
```

---

## Утилиты withUIMeta

```tsx
import {
  withUIMeta,
  withUIMetaDeep,
  enumMeta,
  relationMeta,
  textMeta,
  numberMeta,
  booleanMeta,
  dateMeta,
  commonMeta,
} from '@lena/form-components'
```

Подробнее: [zenstack.md](./zenstack.md#withUIMeta)

---

## Команды сборки

```bash
# Сборка
nx build @lena/form-components

# Линтинг
nx lint @lena/form-components

# Тесты
nx test @lena/form-components
```

---

## Связанные документы

- [README.md](../README.md) — обзор библиотеки
- [fields.md](./fields.md) — Field компоненты
- [form-level.md](./form-level.md) — Form-level компоненты
- [zenstack.md](./zenstack.md) — ZenStack интеграция
- [offline.md](./offline.md) — Offline Support
