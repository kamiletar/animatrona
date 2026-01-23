# Form-level компоненты

Компоненты для управления структурой и поведением формы.

## Обзор компонентов

| Компонент                           | Описание                                        |
| ----------------------------------- | ----------------------------------------------- |
| `Form`                              | Корневой компонент формы                        |
| `Form.Group`                        | Группа полей с dot-notation путём               |
| `Form.Group.List`                   | Автоитерация по массиву                         |
| `Form.Group.List.Button.Add`        | Кнопка добавления элемента                      |
| `Form.Group.List.Button.Remove`     | Кнопка удаления элемента                        |
| `Form.Group.List.Button.DragHandle` | Ручка для перетаскивания (DnD)                  |
| `Form.Button.Submit`                | Кнопка отправки с автоматическим loading        |
| `Form.Button.Reset`                 | Кнопка сброса формы                             |
| `Form.When`                         | Условный рендеринг полей                        |
| `Form.DirtyGuard`                   | Предупреждение при уходе с несохранённой формой |
| `Form.Errors`                       | Сводка всех ошибок валидации                    |
| `Form.Steps`                        | Контейнер для мультистеп форм                   |

---

## Form.When — условный рендеринг (v0.24.0+)

Компонент для показа/скрытия полей в зависимости от значений других полей:

```tsx
<Form initialValue={data} onSubmit={handleSubmit}>
  <Form.Field.Select
    name="type"
    label="Тип клиента"
    options={[
      { label: 'Физлицо', value: 'individual' },
      { label: 'Компания', value: 'company' },
    ]}
  />

  {/* Показывать только для компаний */}
  <Form.When field="type" is="company">
    <Form.Field.String name="companyName" label="Название компании" />
    <Form.Field.String name="inn" label="ИНН" />
  </Form.When>
</Form>
```

**Условия:**

| Prop        | Описание                   | Пример                            |
| ----------- | -------------------------- | --------------------------------- |
| `is`        | Точное совпадение          | `is="company"`                    |
| `isNot`     | Не равно                   | `isNot={true}`                    |
| `in`        | Значение в массиве         | `in={['admin', 'moderator']}`     |
| `notIn`     | Значение не в массиве      | `notIn={['guest']}`               |
| `condition` | Кастомная функция          | `condition={(v) => v >= 18}`      |
| `fallback`  | Контент если условие ложно | `fallback={<Text>Upgrade</Text>}` |

```tsx
// Кастомное условие
<Form.When field="age" condition={(age) => age >= 18}>
  <Form.Field.Checkbox name="adultContent" label="Показывать 18+ контент" />
</Form.When>

// С fallback
<Form.When field="isPremium" is={true} fallback={<Text>Доступно в Premium</Text>}>
  <Form.Field.Select name="premiumTheme" options={themes} />
</Form.When>

// Внутри Form.Group (относительные пути)
<Form.Group name="settings">
  <Form.Field.Switch name="notifications" label="Уведомления" />
  <Form.When field="notifications" is={true}>
    <Form.Field.Select name="frequency" options={frequencies} />
  </Form.When>
</Form.Group>
```

---

## Form.Steps с анимациями (v0.27.0+)

Мультистеп формы с slide анимациями между шагами:

```tsx
<Form initialValue={data} onSubmit={handleSubmit}>
  <Form.Steps animated animationDuration={0.3} validateOnNext linear>
    <Form.Steps.Indicator />

    <Form.Steps.Step title="Personal" description="Your details">
      <Form.Field.String name="firstName" />
      <Form.Field.String name="lastName" />
    </Form.Steps.Step>

    <Form.Steps.Step title="Contact">
      <Form.Field.String name="email" />
    </Form.Steps.Step>

    <Form.Steps.Navigation />
  </Form.Steps>
</Form>
```

**Props:**

- `animated` — включить slide анимации
- `animationDuration` — длительность анимации в секундах (по умолчанию 0.3)
- `validateOnNext` — валидировать поля текущего шага перед переходом
- `linear` — запретить пропуск шагов

### Условные шаги (when)

```tsx
<Form.Steps.Step title="Company Info" when={{ field: 'type', is: 'company' }}>
  <Form.Field.String name="companyName" />
</Form.Steps.Step>
```

### Callbacks между шагами

```tsx
<Form.Steps.Step
  title="Profile"
  onEnter={() => console.log('Вошли на шаг')}
  onLeave={async (direction) => {
    const canLeave = await validateAsync()
    return canLeave  // false отменяет переход
  }}
>
```

### Segment (сегментирование данных)

```tsx
<Form.Steps.Step title="Profile" segment="profile">
  <Form.Field.String name="firstName" /> // → profile.firstName
  <Form.Field.String name="lastName" /> // → profile.lastName
</Form.Steps.Step>
```

### Persistence прогресса шагов

```tsx
<Form.Steps
  stepPersistence={{
    key: 'onboarding',
    debounceMs: 500,
  }}
>
```

### Skip и программный submit

```tsx
<Form.Steps.Navigation
  showSkip
  skipLabel="Пропустить"
  onSkip={async () => {
    await skipOnboardingAction()
    return true
  }}
/>
```

### useFormStepsContext (v0.32.0+)

Хук для программного управления шагами:

```tsx
function CustomNavigation() {
  const { goToNext, goToPrev, skipToEnd, triggerSubmit, clearStepPersistence } = useFormStepsContext()

  return <Button onClick={() => skipToEnd()}>Пропустить всё</Button>
}
```

---

## Form.Errors — сводка ошибок (v0.35.0+)

Компонент для отображения всех ошибок валидации в одном месте:

```tsx
<Form initialValue={data} onSubmit={handleSubmit}>
  <Form.Field.String name="title" />
  <Form.Field.Number name="price" />

  <Form.Errors title="Исправьте ошибки:" />

  <Form.Button.Submit>Сохранить</Form.Button.Submit>
</Form>
```

**Props:**

| Prop    | Тип         | Default                              | Описание               |
| ------- | ----------- | ------------------------------------ | ---------------------- |
| `title` | `ReactNode` | `"Please fix the following errors:"` | Заголовок блока ошибок |

Компонент скрывается когда ошибок нет.

---

## Form Middleware (v0.41.0+)

Перехватчики для обработки событий формы:

```tsx
<Form
  initialValue={data}
  onSubmit={handleSubmit}
  middleware={{
    beforeSubmit: async (data) => {
      if (!(await validateWithServer(data))) return undefined // отмена
      return { ...data, timestamp: Date.now() }
    },

    afterSuccess: (data) => {
      toaster.success({ title: 'Сохранено!' })
      router.push('/list')
    },

    onError: (error) => {
      toaster.error({ title: error.message })
      logError(error)
    },
  }}
>
  ...
</Form>
```

---

## Режимы валидации (v0.27.0+)

Настраиваемые режимы валидации формы:

```tsx
// Валидация при потере фокуса
<Form validateOn="blur" ...>

// Комбинация режимов
<Form validateOn={['blur', 'submit']} ...>

// Доступные режимы: 'change' | 'blur' | 'submit' | 'mount'
```

---

## Глобальное disabled/readOnly (v0.27.0+)

Отключение или режим только для чтения для всей формы:

```tsx
// Все поля отключены
<Form disabled ...>
  <Form.Field.String name="name" />
</Form>

// Все поля только для чтения
<Form readOnly ...>
  <Form.Field.String name="name" />
</Form>
```

Локальный prop поля имеет приоритет над глобальным:

```tsx
<Form disabled>
  <Form.Field.String name="name" /> {/* disabled */}
  <Form.Field.String name="email" disabled={false} /> {/* НЕ disabled */}
</Form>
```

---

## localStorage Persistence (v0.16.0+)

Автоматическое сохранение данных формы с диалогом восстановления:

```tsx
<Form
  initialValue={data}
  onSubmit={handleSubmit}
  persistence={{
    key: 'unique-form-key',
    debounceMs: 500,
    dialogTitle: 'Восстановить?',
    dialogDescription: 'Найдены сохранённые данные',
    restoreButtonText: 'Восстановить',
    discardButtonText: 'Начать заново',
  }}
>
  ...
</Form>
```

---

## useFieldActions (v0.32.0+)

Хук для императивных действий с полями:

```tsx
function CityField() {
  const { value, onChange, setError, clearError } = useFieldActions('city')

  const handleDetect = async () => {
    const location = await detectLocation()
    if (location.error) {
      setError(location.error)
    } else {
      onChange(location.city)
    }
  }

  return (
    <HStack>
      <Form.Field.String name="city" />
      <Button onClick={handleDetect}>
        <LuMapPin />
      </Button>
    </HStack>
  )
}
```

---

## Связанные документы

- [README.md](../README.md) — обзор библиотеки
- [fields.md](./fields.md) — Field компоненты
- [schema-generation.md](./schema-generation.md) — генерация из схемы
