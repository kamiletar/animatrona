import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { booleanMeta, dateMeta, enumMeta, numberMeta, relationMeta, textMeta } from './common-meta'
import { withUIMeta, withUIMetaDeep } from './with-ui-meta'

describe('withUIMeta', () => {
  it('добавляет UI метаданные к простым полям', () => {
    const schema = z.object({
      firstName: z.string(),
      age: z.number(),
      isActive: z.boolean(),
    })

    const enriched = withUIMeta(schema, {
      firstName: { title: 'Имя', placeholder: 'Введите имя' },
      age: { title: 'Возраст', fieldType: 'number' },
      isActive: { title: 'Активен', fieldType: 'switch' },
    })

    // Проверяем что метаданные добавлены
    expect(enriched.shape.firstName.meta()).toEqual({
      ui: { title: 'Имя', placeholder: 'Введите имя' },
    })
    expect(enriched.shape.age.meta()).toEqual({
      ui: { title: 'Возраст', fieldType: 'number' },
    })
    expect(enriched.shape.isActive.meta()).toEqual({
      ui: { title: 'Активен', fieldType: 'switch' },
    })
  })

  it('не изменяет поля без конфигурации', () => {
    const schema = z.object({
      firstName: z.string(),
      lastName: z.string(),
    })

    const enriched = withUIMeta(schema, {
      firstName: { title: 'Имя' },
      // lastName не указан
    })

    expect(enriched.shape.firstName.meta()).toEqual({ ui: { title: 'Имя' } })
    // lastName должен остаться без ui meta
    const lastNameMeta = enriched.shape.lastName.meta()
    expect(lastNameMeta?.ui).toBeUndefined()
  })

  it('работает с enum полями', () => {
    const schema = z.object({
      role: z.enum(['ADMIN', 'USER', 'GUEST']),
    })

    const enriched = withUIMeta(schema, {
      role: {
        title: 'Роль',
        fieldType: 'radioCard',
        fieldProps: {
          options: [
            { value: 'ADMIN', label: 'Администратор' },
            { value: 'USER', label: 'Пользователь' },
            { value: 'GUEST', label: 'Гость' },
          ],
        },
      },
    })

    expect(enriched.shape.role.meta()).toEqual({
      ui: {
        title: 'Роль',
        fieldType: 'radioCard',
        fieldProps: {
          options: [
            { value: 'ADMIN', label: 'Администратор' },
            { value: 'USER', label: 'Пользователь' },
            { value: 'GUEST', label: 'Гость' },
          ],
        },
      },
    })
  })

  it('сохраняет валидацию схемы', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0).max(120),
    })

    const enriched = withUIMeta(schema, {
      email: { title: 'Email' },
      age: { title: 'Возраст' },
    })

    // Валидация должна работать
    expect(enriched.safeParse({ email: 'test@test.com', age: 25 }).success).toBe(true)
    expect(enriched.safeParse({ email: 'invalid', age: 25 }).success).toBe(false)
    expect(enriched.safeParse({ email: 'test@test.com', age: 150 }).success).toBe(false)
  })

  it('работает с optional полями', () => {
    const schema = z.object({
      name: z.string(),
      bio: z.string().optional(),
    })

    const enriched = withUIMeta(schema, {
      name: { title: 'Имя' },
      bio: { title: 'О себе', fieldType: 'textarea' },
    })

    expect(enriched.shape.bio.meta()).toEqual({
      ui: { title: 'О себе', fieldType: 'textarea' },
    })

    // Валидация optional должна работать
    expect(enriched.safeParse({ name: 'John' }).success).toBe(true)
    expect(enriched.safeParse({ name: 'John', bio: 'Hello' }).success).toBe(true)
  })

  it('работает с nullable полями', () => {
    const schema = z.object({
      phone: z.string().nullable(),
    })

    const enriched = withUIMeta(schema, {
      phone: { title: 'Телефон', fieldType: 'phone' },
    })

    expect(enriched.shape.phone.meta()).toEqual({
      ui: { title: 'Телефон', fieldType: 'phone' },
    })

    // Валидация nullable должна работать
    expect(enriched.safeParse({ phone: null }).success).toBe(true)
    expect(enriched.safeParse({ phone: '+79001234567' }).success).toBe(true)
  })

  it('работает с полями с default', () => {
    const schema = z.object({
      isActive: z.boolean().default(true),
    })

    const enriched = withUIMeta(schema, {
      isActive: { title: 'Активен', fieldType: 'switch' },
    })

    expect(enriched.shape.isActive.meta()).toEqual({
      ui: { title: 'Активен', fieldType: 'switch' },
    })

    // Default должен работать
    expect(enriched.parse({})).toEqual({ isActive: true })
  })

  it('работает с массивами', () => {
    const schema = z.object({
      tags: z.array(z.string()),
    })

    const enriched = withUIMeta(schema, {
      tags: { title: 'Теги', fieldType: 'tags' },
    })

    expect(enriched.shape.tags.meta()).toEqual({
      ui: { title: 'Теги', fieldType: 'tags' },
    })
  })
})

describe('withUIMetaDeep', () => {
  it('работает как withUIMeta для плоских схем', () => {
    const schema = z.object({
      firstName: z.string(),
      age: z.number(),
    })

    const enriched = withUIMetaDeep(schema, {
      firstName: { title: 'Имя' },
      age: { title: 'Возраст' },
    })

    expect(enriched.shape.firstName.meta()).toEqual({ ui: { title: 'Имя' } })
    expect(enriched.shape.age.meta()).toEqual({ ui: { title: 'Возраст' } })
  })

  it('обрабатывает вложенные объекты', () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        city: z.string(),
        street: z.string(),
      }),
    })

    const enriched = withUIMetaDeep(schema, {
      name: { title: 'Имя' },
      address: {
        _meta: { title: 'Адрес' },
        city: { title: 'Город' },
        street: { title: 'Улица' },
      },
    })

    expect(enriched.shape.name.meta()).toEqual({ ui: { title: 'Имя' } })
    expect(enriched.shape.address.meta()).toEqual({ ui: { title: 'Адрес' } })

    // Проверяем вложенные поля
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addressShape = (enriched.shape.address as any).shape
    expect(addressShape.city.meta()).toEqual({ ui: { title: 'Город' } })
    expect(addressShape.street.meta()).toEqual({ ui: { title: 'Улица' } })
  })

  it('обрабатывает вложенные объекты без _meta', () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
      }),
    })

    const enriched = withUIMetaDeep(schema, {
      address: {
        city: { title: 'Город' },
      },
    })

    // Нет _meta, поэтому у самого address не должно быть ui meta
    const addressMeta = enriched.shape.address.meta()
    expect(addressMeta?.ui).toBeUndefined()

    // Но у city должен быть
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addressShape = (enriched.shape.address as any).shape
    expect(addressShape.city.meta()).toEqual({ ui: { title: 'Город' } })
  })

  it('обрабатывает optional вложенные объекты', () => {
    const schema = z.object({
      address: z
        .object({
          city: z.string(),
        })
        .optional(),
    })

    const enriched = withUIMetaDeep(schema, {
      address: {
        _meta: { title: 'Адрес' },
        city: { title: 'Город' },
      },
    })

    // Валидация должна работать
    expect(enriched.safeParse({}).success).toBe(true)
    expect(enriched.safeParse({ address: { city: 'Moscow' } }).success).toBe(true)
  })

  it('обрабатывает глубокую вложенность (2+ уровня)', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        address: z.object({
          city: z.string(),
          country: z.string(),
        }),
      }),
    })

    const enriched = withUIMetaDeep(schema, {
      user: {
        _meta: { title: 'Пользователь' },
        name: { title: 'Имя' },
        address: {
          _meta: { title: 'Адрес' },
          city: { title: 'Город' },
          country: { title: 'Страна' },
        },
      },
    })

    expect(enriched.shape.user.meta()).toEqual({ ui: { title: 'Пользователь' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userShape = (enriched.shape.user as any).shape
    expect(userShape.name.meta()).toEqual({ ui: { title: 'Имя' } })
    expect(userShape.address.meta()).toEqual({ ui: { title: 'Адрес' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addressShape = (userShape.address as any).shape
    expect(addressShape.city.meta()).toEqual({ ui: { title: 'Город' } })
    expect(addressShape.country.meta()).toEqual({ ui: { title: 'Страна' } })
  })

  it('сохраняет валидацию во вложенных объектах', () => {
    const schema = z.object({
      address: z.object({
        city: z.string().min(2),
        zip: z.string().length(6),
      }),
    })

    const enriched = withUIMetaDeep(schema, {
      address: {
        city: { title: 'Город' },
        zip: { title: 'Индекс' },
      },
    })

    expect(enriched.safeParse({ address: { city: 'Moscow', zip: '123456' } }).success).toBe(true)
    expect(enriched.safeParse({ address: { city: 'M', zip: '123456' } }).success).toBe(false)
    expect(enriched.safeParse({ address: { city: 'Moscow', zip: '123' } }).success).toBe(false)
  })
})

describe('common-meta хелперы', () => {
  describe('enumMeta', () => {
    it('создаёт метаданные с labels', () => {
      const meta = enumMeta({
        title: 'Роль',
        labels: {
          ADMIN: 'Администратор',
          USER: 'Пользователь',
        },
      })

      expect(meta).toEqual({
        title: 'Роль',
        description: undefined,
        fieldType: 'nativeSelect',
        fieldProps: {
          options: [
            { value: 'ADMIN', label: 'Администратор' },
            { value: 'USER', label: 'Пользователь' },
          ],
        },
      })
    })

    it('создаёт метаданные с options', () => {
      const meta = enumMeta({
        title: 'Приоритет',
        fieldType: 'radioCard',
        options: [
          { value: 'LOW', label: 'Низкий', description: 'Сделать когда-нибудь' },
          { value: 'HIGH', label: 'Высокий', description: 'Срочно!' },
        ],
      })

      expect(meta).toEqual({
        title: 'Приоритет',
        description: undefined,
        fieldType: 'radioCard',
        fieldProps: {
          options: [
            { value: 'LOW', label: 'Низкий', description: 'Сделать когда-нибудь' },
            { value: 'HIGH', label: 'Высокий', description: 'Срочно!' },
          ],
        },
      })
    })
  })

  describe('relationMeta', () => {
    it('создаёт метаданные для relation', () => {
      const meta = relationMeta({
        title: 'Категория',
        model: 'Category',
        labelField: 'name',
      })

      expect(meta).toEqual({
        title: 'Категория',
        fieldType: 'select',
        fieldProps: {
          relation: {
            model: 'Category',
            labelField: 'name',
            valueField: 'id',
          },
        },
      })
    })

    it('поддерживает кастомный valueField', () => {
      const meta = relationMeta({
        title: 'Категория',
        model: 'Category',
        labelField: 'name',
        valueField: 'slug',
      })

      expect(meta.fieldProps?.relation).toEqual({
        model: 'Category',
        labelField: 'name',
        valueField: 'slug',
      })
    })

    it('поддерживает кастомный fieldType', () => {
      const meta = relationMeta({
        title: 'Категория',
        model: 'Category',
        labelField: 'name',
        fieldType: 'combobox',
      })

      expect(meta).toEqual({
        title: 'Категория',
        fieldType: 'combobox',
        fieldProps: {
          relation: {
            model: 'Category',
            labelField: 'name',
            valueField: 'id',
          },
        },
      })
    })

    it('поддерживает все типы selection полей', () => {
      const fieldTypes = ['select', 'nativeSelect', 'radioGroup', 'radioCard', 'listbox'] as const

      for (const fieldType of fieldTypes) {
        const meta = relationMeta({
          title: 'Тест',
          model: 'Test',
          labelField: 'name',
          fieldType,
        })

        expect(meta.fieldType).toBe(fieldType)
      }
    })

    it('комбинирует fieldType с fieldProps', () => {
      const meta = relationMeta({
        title: 'Категория',
        model: 'Category',
        labelField: 'name',
        fieldType: 'radioCard',
        fieldProps: { columns: 2 },
      })

      expect(meta).toEqual({
        title: 'Категория',
        fieldType: 'radioCard',
        fieldProps: {
          relation: {
            model: 'Category',
            labelField: 'name',
            valueField: 'id',
          },
          columns: 2,
        },
      })
    })
  })

  describe('textMeta', () => {
    it('создаёт метаданные для текстового поля', () => {
      const meta = textMeta({
        title: 'Имя',
        placeholder: 'Введите имя',
      })

      expect(meta).toEqual({
        title: 'Имя',
        placeholder: 'Введите имя',
        description: undefined,
        fieldType: 'string',
        fieldProps: undefined,
      })
    })

    it('поддерживает разные fieldType', () => {
      const meta = textMeta({
        title: 'О себе',
        fieldType: 'richText',
      })

      expect(meta.fieldType).toBe('richText')
    })
  })

  describe('numberMeta', () => {
    it('создаёт метаданные для числового поля', () => {
      const meta = numberMeta({
        title: 'Возраст',
        min: 0,
        max: 120,
      })

      expect(meta).toEqual({
        title: 'Возраст',
        description: undefined,
        fieldType: 'number',
        fieldProps: { min: 0, max: 120 },
      })
    })

    it('поддерживает currency', () => {
      const meta = numberMeta({
        title: 'Цена',
        fieldType: 'currency',
        currency: 'RUB',
      })

      expect(meta.fieldType).toBe('currency')
      expect(meta.fieldProps?.currency).toBe('RUB')
    })

    it('поддерживает rating', () => {
      const meta = numberMeta({
        title: 'Рейтинг',
        fieldType: 'rating',
        count: 5,
      })

      expect(meta.fieldType).toBe('rating')
      expect(meta.fieldProps?.count).toBe(5)
    })
  })

  describe('booleanMeta', () => {
    it('создаёт метаданные для checkbox', () => {
      const meta = booleanMeta({
        title: 'Согласен',
      })

      expect(meta).toEqual({
        title: 'Согласен',
        description: undefined,
        fieldType: 'checkbox',
        fieldProps: undefined,
      })
    })

    it('создаёт метаданные для switch', () => {
      const meta = booleanMeta({
        title: 'Активен',
        fieldType: 'switch',
        description: 'Включить уведомления',
      })

      expect(meta).toEqual({
        title: 'Активен',
        description: 'Включить уведомления',
        fieldType: 'switch',
        fieldProps: undefined,
      })
    })
  })

  describe('dateMeta', () => {
    it('создаёт метаданные для даты', () => {
      const meta = dateMeta({
        title: 'Дата рождения',
      })

      expect(meta).toEqual({
        title: 'Дата рождения',
        description: undefined,
        fieldType: 'date',
        fieldProps: {},
      })
    })

    it('поддерживает dateTimePicker', () => {
      const meta = dateMeta({
        title: 'Встреча',
        fieldType: 'dateTimePicker',
      })

      expect(meta.fieldType).toBe('dateTimePicker')
    })

    it('поддерживает min/max', () => {
      const meta = dateMeta({
        title: 'Длительность',
        fieldType: 'duration',
        min: 15,
        max: 480,
      })

      expect(meta.fieldProps).toEqual({ min: 15, max: 480 })
    })
  })
})

describe('интеграция withUIMeta с хелперами', () => {
  it('работает с enumMeta', () => {
    const schema = z.object({
      role: z.enum(['ADMIN', 'USER']),
    })

    const enriched = withUIMeta(schema, {
      role: enumMeta({
        title: 'Роль',
        fieldType: 'radioCard',
        labels: { ADMIN: 'Администратор', USER: 'Пользователь' },
      }),
    })

    const meta = enriched.shape.role.meta()
    expect(meta.ui.title).toBe('Роль')
    expect(meta.ui.fieldType).toBe('radioCard')
    expect(meta.ui.fieldProps.options).toHaveLength(2)
  })

  it('работает с relationMeta', () => {
    const schema = z.object({
      categoryId: z.string(),
    })

    const enriched = withUIMeta(schema, {
      categoryId: relationMeta({
        title: 'Категория',
        model: 'Category',
        labelField: 'name',
      }),
    })

    const meta = enriched.shape.categoryId.meta()
    expect(meta.ui.title).toBe('Категория')
    expect(meta.ui.fieldType).toBe('select')
    expect(meta.ui.fieldProps.relation.model).toBe('Category')
  })

  it('работает с комбинацией хелперов', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
      role: z.enum(['ADMIN', 'USER']),
      birthDate: z.date().optional(),
    })

    const enriched = withUIMeta(schema, {
      name: textMeta({ title: 'Имя', placeholder: 'Введите имя' }),
      age: numberMeta({ title: 'Возраст', min: 0, max: 120 }),
      isActive: booleanMeta({ title: 'Активен', fieldType: 'switch' }),
      role: enumMeta({
        title: 'Роль',
        labels: { ADMIN: 'Админ', USER: 'Юзер' },
      }),
      birthDate: dateMeta({ title: 'Дата рождения' }),
    })

    expect(enriched.shape.name.meta().ui.title).toBe('Имя')
    expect(enriched.shape.age.meta().ui.fieldProps.min).toBe(0)
    expect(enriched.shape.isActive.meta().ui.fieldType).toBe('switch')
    expect(enriched.shape.role.meta().ui.fieldProps.options).toHaveLength(2)
    expect(enriched.shape.birthDate.meta().ui.fieldType).toBe('date')
  })
})
