'use client'

import { VStack } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'
import { resolveFieldType, SchemaFieldWithRelations } from './field-type-mapper'
import { useDeclarativeForm } from './form-context'
import { FormGroupDeclarative } from './form-group/form-group-declarative'
import { ListButtonAdd, ListButtonRemove } from './form-group/form-group-list-buttons'
import { FormGroupListDeclarative } from './form-group/form-group-list-declarative'
import { filterFields, traverseSchema, type SchemaFieldInfo } from './schema-traversal'

/**
 * Props для Form.AutoFields
 */
export interface AutoFieldsProps {
  /**
   * Включить только указанные поля (по имени)
   * @example include={['firstName', 'lastName']}
   */
  include?: string[]
  /**
   * Исключить указанные поля (по имени)
   * @example exclude={['id', 'createdAt']}
   */
  exclude?: string[]
  /**
   * Рекурсивно генерировать вложенные объекты
   * @default true
   */
  recursive?: boolean
  /**
   * Кастомный wrapper для каждого поля
   * @example fieldWrapper={({ name, children }) => <Box key={name} mb={4}>{children}</Box>}
   */
  fieldWrapper?: (props: { name: string; children: ReactNode }) => ReactElement
}

/**
 * Рендерить поле или группу на основе SchemaFieldInfo
 */
function renderField(
  field: SchemaFieldInfo,
  recursive: boolean,
  fieldWrapper?: (props: { name: string; children: ReactNode }) => ReactElement
): ReactElement {
  const { name, zodType, ui } = field

  // Обработка вложенных объектов
  if (zodType === 'object' && field.children && recursive) {
    const content = (
      <FormGroupDeclarative key={name} name={name}>
        {field.children.map((child) => renderField(child, recursive, fieldWrapper))}
      </FormGroupDeclarative>
    )
    return fieldWrapper ? fieldWrapper({ name, children: content }) : content
  }

  // Обработка массивов объектов
  if (zodType === 'array' && field.element?.zodType === 'object' && field.element.children) {
    const elementChildren = field.element.children
    const content = (
      <FormGroupListDeclarative
        key={name}
        name={name}
        emptyContent={<EmptyArrayContent label={ui?.title ?? name} />}
        wrapper={({ children }) => (
          <VStack align="stretch" gap={2}>
            {children}
            <ListButtonAdd defaultValue={createDefaultValue(elementChildren)}>Добавить</ListButtonAdd>
          </VStack>
        )}
      >
        <VStack align="stretch" gap={2} p={2} borderWidth={1} borderRadius="md">
          {elementChildren.map((child) => renderField(child, recursive, fieldWrapper))}
          <ListButtonRemove>Удалить</ListButtonRemove>
        </VStack>
      </FormGroupListDeclarative>
    )
    return fieldWrapper ? fieldWrapper({ name, children: content }) : content
  }

  // Обработка примитивных массивов → Tags
  if (zodType === 'array' && field.element?.zodType === 'string') {
    const fieldType = resolveFieldType(field)
    if (fieldType === 'tags') {
      const content = <SchemaFieldWithRelations key={name} field={field} />
      return fieldWrapper ? fieldWrapper({ name, children: content }) : content
    }
  }

  // Обычное поле (с поддержкой relation options из RelationFieldProvider)
  const content = <SchemaFieldWithRelations key={name} field={field} />
  return fieldWrapper ? fieldWrapper({ name, children: content }) : content
}

/**
 * Компонент для пустого массива
 */
function EmptyArrayContent({ label }: { label: string }): ReactElement {
  return (
    <VStack py={4} color="fg.muted">
      Нет элементов в &quot;{label}&quot;
    </VStack>
  )
}

/**
 * Создать дефолтное значение для элемента массива объектов
 */
function createDefaultValue(children: SchemaFieldInfo[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const child of children) {
    switch (child.zodType) {
      case 'string':
        result[child.name] = ''
        break
      case 'number':
      case 'int':
      case 'float':
      case 'bigint':
        result[child.name] = 0
        break
      case 'boolean':
        result[child.name] = false
        break
      case 'array':
        result[child.name] = []
        break
      case 'object':
        if (child.children) {
          result[child.name] = createDefaultValue(child.children)
        } else {
          result[child.name] = {}
        }
        break
      default:
        result[child.name] = undefined
    }
  }

  return result
}

/**
 * Form.AutoFields — автоматическая генерация полей из Zod схемы
 *
 * Компонент читает Zod схему из контекста Form и автоматически генерирует
 * поля на основе типов и метаданных схемы.
 *
 * @example Все поля
 * ```tsx
 * <Form schema={Schema} initialValue={data} onSubmit={save}>
 *   <Form.AutoFields />
 *   <Form.Button.Submit>Сохранить</Form.Button.Submit>
 * </Form>
 * ```
 *
 * @example С фильтрацией
 * ```tsx
 * <Form schema={Schema} initialValue={data} onSubmit={save}>
 *   <HStack>
 *     <Form.AutoFields include={['firstName', 'lastName']} />
 *   </HStack>
 *   <Form.AutoFields exclude={['firstName', 'lastName']} />
 *   <Form.Button.Submit />
 * </Form>
 * ```
 *
 * @example С кастомным wrapper
 * ```tsx
 * <Form.AutoFields fieldWrapper={({ name, children }) => (
 *   <Box key={name} mb={4}>{children}</Box>
 * )} />
 * ```
 */
export function FormAutoFields({ include, exclude, recursive = true, fieldWrapper }: AutoFieldsProps): ReactElement {
  const { schema } = useDeclarativeForm()

  if (!schema) {
    throw new Error('Form.AutoFields требует schema prop на Form компоненте')
  }

  // Обойти схему и получить информацию о полях
  const allFields = traverseSchema(schema)

  // Отфильтровать поля
  const fields = filterFields(allFields, { include, exclude })

  return <Fragment>{fields.map((field) => renderField(field, recursive, fieldWrapper))}</Fragment>
}

FormAutoFields.displayName = 'FormAutoFields'
