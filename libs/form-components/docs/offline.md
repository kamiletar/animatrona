# Offline Support

Компоненты и хуки для работы с формами в оффлайн режиме с очередью синхронизации.

## Обзор

```tsx
import { Form } from '@lena/form-components'
;<Form initialValue={data} onSubmit={handleSubmit}>
  {/* Показывается когда браузер оффлайн */}
  <Form.OfflineIndicator />

  <Form.Field.String name="title" />
  <Form.Button.Submit>Сохранить</Form.Button.Submit>
</Form>
```

---

## Form.OfflineIndicator

Автоматически отображается когда браузер теряет соединение:

```tsx
<Form.OfflineIndicator
  label="Нет связи" // Текст (по умолчанию: "Оффлайн режим")
  colorPalette="red" // Цвет (по умолчанию: "orange")
  variant="solid" // Вариант Badge
/>
```

---

## Form.SyncStatus

Индикатор статуса синхронизации очереди (можно использовать вне формы):

```tsx
import { FormSyncStatus } from '@lena/form-components/offline'

// В layout или header
;<FormSyncStatus
  showWhenEmpty={false} // Показывать когда очередь пуста
  syncingLabel="Синхронизация..." // Текст при синхронизации
  pendingLabel={(count) => `Ожидает: ${count}`} // Текст с очередью
  syncedLabel="Всё синхронизировано" // Текст когда синхронизировано
/>
```

**Состояния:**

- 🔄 Spinner — синхронизация в процессе
- 🕐 Оранжевый — есть ожидающие действия
- ✅ Зелёный — всё синхронизировано

---

## Хуки для оффлайн

```typescript
import { useOfflineStatus, useSyncQueue } from '@lena/form-components/offline'

// Проверка статуса сети
const isOffline = useOfflineStatus()

// Работа с очередью синхронизации
const { pendingCount, isProcessing } = useSyncQueue()
```

---

## Form с offline prop

Интеграция оффлайн-режима напрямую в Form:

```tsx
<Form
  initialValue={data}
  offline={{
    actionType: 'UPDATE_PROFILE',
    storageKey: 'profile-sync-queue', // опционально
    onQueued: () => toaster.info('Сохранено локально'),
    onSynced: () => toaster.success('Синхронизировано'),
    onSyncError: (error) => toaster.error(error),
  }}
  onSubmit={handleSubmit}
>
  <Form.Field.String name="name" />
  <Form.OfflineIndicator />
  <Form.Button.Submit />
</Form>
```

---

## useOfflineForm

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

## Интеграция с persist

Объединение оффлайн и localStorage persistence:

```tsx
<Form
  initialValue={data}
  persist={{ key: 'profile-draft', ttl: 24 * 60 * 60 * 1000 }}
  offline={{ actionType: 'UPDATE_PROFILE' }}
  onSubmit={handleSubmit}
>
  {/* Черновик сохраняется при вводе */}
  {/* При submit оффлайн — добавляется в очередь */}
  {/* При успешной синхронизации — черновик удаляется */}
</Form>
```

---

## Типы действий

Настраиваемые типы синхронизации:

```tsx
// В библиотеке — базовые типы
type BaseSyncActionType = 'FORM_SUBMIT' | 'FORM_UPDATE' | 'FORM_DELETE'

// В приложении — расширение
declare module '@lena/form-components/offline' {
  interface SyncActionTypeRegistry {
    BOOK_LESSON: true
    UPDATE_PROFILE: true
  }
}

type SyncActionType = BaseSyncActionType | keyof SyncActionTypeRegistry
```

---

## Связанные документы

- [README.md](../README.md) — обзор библиотеки
- [form-level.md](./form-level.md) — Form-level компоненты
- [/.claude/docs/pwa-offline.md](../../../.claude/docs/pwa-offline.md) — PWA и оффлайн паттерны
