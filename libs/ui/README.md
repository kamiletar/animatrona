# @lena/ui

Shared UI компоненты для приложений Lena.

## Установка

Библиотека уже включена в монорепозиторий.

```typescript
import { TopLoader, ConfirmDialog, RatingStars } from '@lena/ui'
```

## Компоненты

### TopLoader

Индикатор загрузки страницы в стиле YouTube.

```tsx
import { TopLoader } from '@lena/ui'

<TopLoader />
```

### ConfirmDialog

Диалог подтверждения действия.

```tsx
import { ConfirmDialog } from '@lena/ui'

<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Удалить запись?"
  description="Это действие нельзя отменить"
  onConfirm={handleDelete}
/>
```

### RatingStars / RatingDisplay

Компоненты для отображения рейтинга.

```tsx
import { RatingStars, RatingDisplay } from '@lena/ui'

// Интерактивные звёзды
<RatingStars value={rating} onChange={setRating} />

// Только отображение
<RatingDisplay value={4.5} />
```

### FilterPanel

Панель фильтров с URL-синхронизацией.

```tsx
import { FilterPanel, FilterRow, FilterField } from '@lena/ui'

<FilterPanel>
  <FilterRow>
    <FilterField name="status" label="Статус">
      <Select options={statusOptions} />
    </FilterField>
  </FilterRow>
</FilterPanel>
```

### StatCard / RoleStat

Карточки статистики для дашбордов.

```tsx
import { StatCard, RoleStat } from '@lena/ui'

<StatCard title="Пользователи" value={1234} />
<RoleStat role="ADMIN" count={5} />
```

### OptimizedAvatar

Оптимизированный аватар с lazy loading.

```tsx
import { OptimizedAvatar } from '@lena/ui'

<OptimizedAvatar src="/avatar.jpg" name="Иван" />
```

### ReviewCard

Карточка отзыва.

```tsx
import { ReviewCard } from '@lena/ui'

<ReviewCard
  review={{ text: 'Отличный сервис!', rating: 5 }}
  author={{ name: 'Анна', avatar: '/anna.jpg' }}
/>
```

## Хуки

### useServiceWorker

Хук для работы с Service Worker.

```tsx
import { useServiceWorker } from '@lena/ui'

const { registration, updateAvailable, update } = useServiceWorker()
```

### useUrlFilters

Хук для синхронизации фильтров с URL.

```tsx
import { useUrlFilters } from '@lena/ui'

const { filters, setFilter, resetFilters } = useUrlFilters({
  defaultFilters: { status: 'active' }
})
```

## Команды

```bash
nx build ui
nx test ui
nx lint ui
```
