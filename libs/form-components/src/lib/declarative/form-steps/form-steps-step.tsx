'use client'

import { Steps } from '@chakra-ui/react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDeclarativeForm } from '../form-context'
import { FormGroupDeclarative } from '../form-group/form-group-declarative'
import { useFormStepsContext, type StepInfo } from './form-steps-context'

/**
 * Условие отображения шага
 */
export interface StepWhenCondition<TValue = unknown> {
  /** Поле для отслеживания */
  field: string
  /** Показывать шаг когда значение равно */
  is?: TValue
  /** Показывать шаг когда значение НЕ равно */
  isNot?: TValue
  /** Показывать шаг когда значение в массиве */
  in?: TValue[]
  /** Показывать шаг когда значение НЕ в массиве */
  notIn?: TValue[]
  /** Кастомная функция условия */
  condition?: (value: TValue) => boolean
}

export interface FormStepsStepProps {
  /** Step title shown in indicator */
  title: string
  /** Optional description shown in indicator */
  description?: string
  /** Optional icon for the step */
  icon?: ReactNode
  /** Step content (form fields) */
  children: ReactNode
  /** Callback при входе на шаг */
  onEnter?: () => void
  /** Callback при уходе с шага (может отменить переход возвращая false) */
  onLeave?: (direction: 'forward' | 'backward') => Promise<boolean> | boolean
  /** Условие отображения шага (шаг показывается только если условие истинно) */
  when?: StepWhenCondition
  /**
   * Segment name for automatic Form.Group wrapping.
   * When provided, all fields inside this step will be automatically
   * namespaced under this segment (e.g., segment="profile" makes
   * name="firstName" resolve to "profile.firstName").
   *
   * @example
   * ```tsx
   * <Form.Steps.Step title="Profile" segment="profile">
   *   <Form.Field.String name="firstName" /> // resolves to profile.firstName
   *   <Form.Field.String name="lastName" />  // resolves to profile.lastName
   * </Form.Steps.Step>
   * ```
   */
  segment?: string
}

/**
 * Extract field names from children recursively
 * Looks for components with 'name' prop
 */
function extractFieldNames(children: ReactNode, parentPath = ''): string[] {
  const names: string[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return
    }

    const props = child.props as Record<string, unknown>

    // Check if this is a field component with name prop
    if (typeof props.name === 'string') {
      const fullName = parentPath ? `${parentPath}.${props.name}` : props.name
      names.push(fullName)
    }

    // Check for Form.Group - it creates a namespace
    const displayName = (child.type as { displayName?: string })?.displayName
    if (displayName === 'FormGroupDeclarative' && typeof props.name === 'string') {
      const groupPath = parentPath ? `${parentPath}.${props.name}` : props.name
      if (props.children) {
        names.push(...extractFieldNames(props.children as ReactNode, groupPath))
      }
    }
    // Recurse into children (but not into Form.Group.List - arrays are handled differently)
    else if (props.children && displayName !== 'FormGroupListDeclarative') {
      names.push(...extractFieldNames(props.children as ReactNode, parentPath))
    }
  })

  return names
}

/** Смещение для slide анимации в пикселях */
const SLIDE_OFFSET = 50

/**
 * Вычисляет значение условия when
 */
function evaluateWhenCondition(when: StepWhenCondition | undefined, fieldValue: unknown): boolean {
  if (!when) {
    return true // Нет условия — всегда показываем
  }

  if (when.condition !== undefined) {
    return when.condition(fieldValue)
  }
  if (when.is !== undefined) {
    return fieldValue === when.is
  }
  if (when.isNot !== undefined) {
    return fieldValue !== when.isNot
  }
  if (when.in !== undefined) {
    return when.in.includes(fieldValue as never)
  }
  if (when.notIn !== undefined) {
    return !when.notIn.includes(fieldValue as never)
  }

  // По умолчанию — truthy проверка
  return Boolean(fieldValue)
}

/**
 * Получает значение вложенного поля по dot-notation пути
 */
function getNestedValue(values: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let value: unknown = values
  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return value
}

/**
 * Form.Steps.Step - Individual step content
 *
 * Registers itself with Form.Steps and provides content for that step.
 * Field names are automatically extracted for validation.
 * Supports slide animations when Form.Steps has `animated` prop.
 *
 * @example Basic usage
 * ```tsx
 * <Form.Steps.Step title="Personal Info" description="Your details">
 *   <Form.Field.String name="firstName" label="First Name" />
 *   <Form.Field.String name="lastName" label="Last Name" />
 * </Form.Steps.Step>
 * ```
 *
 * @example Conditional step (показывается только для определённой роли)
 * ```tsx
 * <Form.Steps.Step
 *   title="Company Info"
 *   when={{ field: 'type', is: 'company' }}
 * >
 *   <Form.Field.String name="companyName" label="Company Name" />
 * </Form.Steps.Step>
 * ```
 */
export function FormStepsStep({
  title,
  description,
  icon,
  children,
  onEnter,
  onLeave,
  when,
  segment,
}: FormStepsStepProps) {
  const { form } = useDeclarativeForm()
  const { registerStep, unregisterStep, steps, currentStep, animated, animationDuration, direction } =
    useFormStepsContext()

  // Wrap children in FormGroupDeclarative if segment is provided
  const wrappedChildren = segment ? <FormGroupDeclarative name={segment}>{children}</FormGroupDeclarative> : children

  // Parent path for field extraction (accounts for segment)
  const fieldExtractionPath = segment ?? ''

  // Отслеживаем видимость шага на основе when условия
  const [isVisible, setIsVisible] = useState(() => {
    if (!when) {
      return true
    }
    const fieldValue = getNestedValue(form.state.values as Record<string, unknown>, when.field)
    return evaluateWhenCondition(when, fieldValue)
  })

  // Calculate index based on render order
  // We use a ref to track the registered index
  const indexRef = useRef<number>(-1)
  const wasVisibleRef = useRef(isVisible)

  // Подписка на изменения поля when
  useEffect(() => {
    if (!when) {
      return
    }

    const unsubscribe = form.store.subscribe(() => {
      const fieldValue = getNestedValue(form.state.values as Record<string, unknown>, when.field)
      const newIsVisible = evaluateWhenCondition(when, fieldValue)
      if (newIsVisible !== wasVisibleRef.current) {
        wasVisibleRef.current = newIsVisible
        setIsVisible(newIsVisible)
      }
    })

    return unsubscribe
  }, [form, when])

  // Assign index on mount (только если шаг видим)
  // ВАЖНО: steps НЕ должен быть в dependency array — иначе бесконечный цикл!
  // registerStep обновляет steps, что вызовет effect снова.
  // Используем stepsRef для доступа к актуальному значению без зависимости.
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  useEffect(() => {
    if (!isVisible) {
      // Шаг скрыт — не регистрируем
      if (indexRef.current >= 0) {
        unregisterStep(indexRef.current)
        indexRef.current = -1
      }
      return
    }

    // Find next available index (используем ref чтобы избежать dependency на steps)
    const existingIndices = stepsRef.current.map((s) => s.index)
    let nextIndex = 0
    while (existingIndices.includes(nextIndex)) {
      nextIndex++
    }

    // Если индекс уже назначен — используем его
    if (indexRef.current < 0) {
      indexRef.current = nextIndex
    }

    // ВАЖНО: fieldNames извлекаются ОДИН РАЗ при монтировании
    // children НЕ включены в deps — они меняются каждый рендер
    const fieldNames = extractFieldNames(children, fieldExtractionPath)

    const stepInfo: StepInfo = {
      index: indexRef.current,
      title,
      description,
      icon,
      fieldNames,
      onEnter,
      onLeave,
    }

    registerStep(stepInfo)

    return () => {
      if (indexRef.current >= 0) {
        unregisterStep(indexRef.current)
      }
    }
    // ВАЖНО: steps и children намеренно НЕ включены — вызывают бесконечный цикл
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, icon, registerStep, title, unregisterStep, onEnter, onLeave, isVisible, fieldExtractionPath])

  // Извлекаем fieldNames и мемоизируем их строковое представление
  // для использования в dependency array вместо children
  const fieldNamesRef = useRef<string[]>([])
  const currentFieldNames = useMemo(
    () => extractFieldNames(children, fieldExtractionPath),
    // Используем segment path как proxy для определения когда структура может измениться
    // children НЕ включаем — они меняются на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldExtractionPath]
  )

  // Обновляем ref только если fieldNames реально изменились
  const fieldNamesChanged =
    currentFieldNames.length !== fieldNamesRef.current.length ||
    currentFieldNames.some((name, i) => name !== fieldNamesRef.current[i])
  if (fieldNamesChanged) {
    fieldNamesRef.current = currentFieldNames
  }

  // Update step info if props change (but keep same index)
  // ВАЖНО: children НЕ включён в deps — он меняется каждый рендер и вызовет бесконечный цикл
  useEffect(() => {
    if (indexRef.current >= 0 && isVisible) {
      const stepInfo: StepInfo = {
        index: indexRef.current,
        title,
        description,
        icon,
        fieldNames: fieldNamesRef.current,
        onEnter,
        onLeave,
      }
      registerStep(stepInfo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, icon, registerStep, onEnter, onLeave, isVisible, fieldExtractionPath])

  const index = indexRef.current

  // Варианты анимации для slide эффекта
  const slideVariants: Variants = useMemo(
    () => ({
      // Начальное состояние: элемент появляется с нужной стороны
      initial: {
        opacity: 0,
        x: direction === 'forward' ? SLIDE_OFFSET : -SLIDE_OFFSET,
      },
      // Финальное состояние: элемент на месте
      animate: {
        opacity: 1,
        x: 0,
      },
      // Состояние выхода: элемент уходит в противоположную сторону
      exit: {
        opacity: 0,
        x: direction === 'forward' ? -SLIDE_OFFSET : SLIDE_OFFSET,
      },
    }),
    [direction]
  )

  // Шаг скрыт через when условие — не рендерим
  if (!isVisible) {
    return null
  }

  // Don't render until we have a valid index
  if (index < 0) {
    return null
  }

  // Проверяем, является ли этот шаг текущим
  const isActive = index === currentStep

  // Если анимации отключены — рендерим обычный Steps.Content
  if (!animated) {
    return <Steps.Content index={index}>{wrappedChildren}</Steps.Content>
  }

  // С анимациями — оборачиваем в AnimatePresence + motion.div
  return (
    <Steps.Content index={index}>
      <AnimatePresence mode="wait" initial={false}>
        {isActive && (
          <motion.div
            key={`step-${index}`}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={slideVariants}
            transition={{
              duration: animationDuration,
              ease: 'easeInOut',
            }}
          >
            {wrappedChildren}
          </motion.div>
        )}
      </AnimatePresence>
    </Steps.Content>
  )
}

FormStepsStep.displayName = 'FormStepsStep'
