'use server'

/**
 * Server Actions для CRUD операций с EncodingProfile
 * Заменяет ZenStack hooks для работы с профилями кодирования
 */

import type { EncodingProfile, Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/db'

// === READ ===

/**
 * Получить список профилей кодирования
 */
export async function findManyEncodingProfiles(args?: Prisma.EncodingProfileFindManyArgs): Promise<EncodingProfile[]> {
  return prisma.encodingProfile.findMany(args)
}

/**
 * Получить профиль по ID
 */
export async function findUniqueEncodingProfile(
  id: string,
  include?: Prisma.EncodingProfileInclude
): Promise<EncodingProfile | null> {
  return prisma.encodingProfile.findUnique({
    where: { id },
    include,
  })
}

/**
 * Получить первый профиль по условию (для профиля по умолчанию)
 */
export async function findFirstEncodingProfile(
  args?: Prisma.EncodingProfileFindFirstArgs
): Promise<EncodingProfile | null> {
  return prisma.encodingProfile.findFirst(args)
}

/**
 * Получить профиль по умолчанию
 */
export async function getDefaultEncodingProfile(): Promise<EncodingProfile | null> {
  return prisma.encodingProfile.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: 'desc' },
  })
}

// === CREATE ===

/**
 * Создать новый профиль кодирования
 */
export async function createEncodingProfile(data: Prisma.EncodingProfileCreateInput): Promise<EncodingProfile> {
  // Если новый профиль отмечен как default, сбрасываем флаг у остальных
  if (data.isDefault) {
    await prisma.encodingProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.encodingProfile.create({ data })
}

// === UPDATE ===

/**
 * Обновить профиль кодирования
 */
export async function updateEncodingProfile(
  id: string,
  data: Prisma.EncodingProfileUpdateInput
): Promise<EncodingProfile> {
  // Если профиль становится default, сбрасываем флаг у остальных
  if (data.isDefault === true) {
    await prisma.encodingProfile.updateMany({
      where: { id: { not: id }, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.encodingProfile.update({
    where: { id },
    data,
  })
}

/**
 * Установить профиль по умолчанию
 */
export async function setDefaultEncodingProfile(id: string): Promise<EncodingProfile> {
  // Сбрасываем флаг у всех профилей
  await prisma.encodingProfile.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  })

  // Устанавливаем новый профиль по умолчанию
  return prisma.encodingProfile.update({
    where: { id },
    data: { isDefault: true },
  })
}

// === DELETE ===

/**
 * Удалить профиль кодирования
 * Нельзя удалять встроенные профили
 */
export async function deleteEncodingProfile(id: string): Promise<{ success: boolean; error?: string }> {
  const profile = await prisma.encodingProfile.findUnique({ where: { id } })

  if (!profile) {
    return { success: false, error: 'Профиль не найден' }
  }

  if (profile.isBuiltIn) {
    return { success: false, error: 'Нельзя удалить встроенный профиль' }
  }

  await prisma.encodingProfile.delete({ where: { id } })
  return { success: true }
}

// === SEED ===

/**
 * Встроенные профили кодирования
 * Оптимизированы для RTX 5080 (Blackwell, 9th gen NVENC, Dual Encoders)
 */
const BUILT_IN_PROFILES = [
  {
    name: 'Быстрый',
    isBuiltIn: true,
    isDefault: false,
    codec: 'AV1' as const,
    useGpu: true,
    preferCpu: false,
    rateControl: 'VBR' as const,
    cq: 32,
    preset: 'p1',
    tune: 'NONE' as const,
    multipass: 'DISABLED' as const,
    spatialAq: true,
    temporalAq: true,
    aqStrength: 8,
    gopSize: 240,
    bRefMode: 'DISABLED' as const,
    force10Bit: false,
    temporalFilter: false,
    deband: true,
  },
  {
    name: 'Баланс',
    isBuiltIn: true,
    isDefault: false,
    codec: 'AV1' as const,
    useGpu: true,
    preferCpu: false,
    rateControl: 'VBR' as const,
    cq: 28,
    preset: 'p5',
    tune: 'HQ' as const,
    multipass: 'DISABLED' as const,
    spatialAq: true,
    temporalAq: true,
    aqStrength: 8,
    gopSize: 240,
    bRefMode: 'DISABLED' as const,
    force10Bit: false,
    temporalFilter: false,
    deband: true,
  },
  {
    name: 'Качество',
    isBuiltIn: true,
    isDefault: false,
    codec: 'AV1' as const,
    useGpu: true,
    preferCpu: false,
    rateControl: 'VBR' as const,
    cq: 24,
    preset: 'p7',
    tune: 'HQ' as const,
    multipass: 'FULLRES' as const,
    spatialAq: true,
    temporalAq: true,
    aqStrength: 8,
    lookahead: 250,
    lookaheadLevel: 3,
    gopSize: 240,
    bRefMode: 'MIDDLE' as const,
    force10Bit: false,
    temporalFilter: false,
    deband: true,
  },
  {
    name: 'Blackwell UHQ',
    isBuiltIn: true,
    isDefault: true, // Профиль по умолчанию
    codec: 'AV1' as const,
    useGpu: true,
    preferCpu: false,
    rateControl: 'VBR' as const, // VBR с -cq (Constant Quality), не CONSTQP с -qp
    cq: 24,
    preset: 'p7',
    tune: 'UHQ' as const,
    multipass: 'FULLRES' as const,
    spatialAq: true,
    temporalAq: true,
    aqStrength: 8,
    lookahead: 250,
    lookaheadLevel: 3,
    gopSize: 240,
    bRefMode: 'MIDDLE' as const,
    force10Bit: true,
    temporalFilter: true, // Blackwell-специфичная фича
    deband: true,
  },
  {
    name: 'Архив',
    isBuiltIn: true,
    isDefault: false,
    codec: 'AV1' as const,
    useGpu: true,
    preferCpu: false,
    rateControl: 'VBR' as const, // VBR с -cq (Constant Quality), не CONSTQP с -qp
    cq: 20,
    preset: 'p7',
    tune: 'UHQ' as const,
    multipass: 'FULLRES' as const,
    spatialAq: true,
    temporalAq: true,
    aqStrength: 8,
    lookahead: 250,
    lookaheadLevel: 3,
    gopSize: 240,
    bRefMode: 'MIDDLE' as const,
    force10Bit: true,
    temporalFilter: true,
    deband: true,
  },
] as const

/**
 * Инициализирует встроенные профили в БД
 * Вызывается при запуске приложения через Server Action
 *
 * ВАЖНО: Обновляет существующие профили до актуальной версии!
 * Это необходимо для применения исправлений (например CONSTQP → VBR).
 */
export async function seedEncodingProfiles(): Promise<void> {
  for (const profile of BUILT_IN_PROFILES) {
    try {
      // Проверяем существует ли профиль по имени
      const existing = await prisma.encodingProfile.findFirst({
        where: { name: profile.name, isBuiltIn: true },
      })

      if (!existing) {
        // Создаём новый профиль
        await prisma.encodingProfile.create({
          data: profile,
        })
      } else {
        // Обновляем существующий профиль до актуальной версии
        // Сохраняем пользовательские настройки isDefault
        const { isDefault: _isDefault, ...updateData } = profile
        await prisma.encodingProfile.update({
          where: { id: existing.id },
          data: updateData,
        })
      }
    } catch {
      // Продолжаем с другими профилями
    }
  }
}

// === RESET ===

/**
 * Сбросить встроенный профиль на оригинальные значения
 */
export async function resetBuiltInProfile(id: string): Promise<EncodingProfile | null> {
  const profile = await prisma.encodingProfile.findUnique({ where: { id } })

  if (!profile || !profile.isBuiltIn) {
    return null
  }

  // Находим оригинальные данные встроенного профиля
  const originalData = BUILT_IN_PROFILES.find((p) => p.name === profile.name)

  if (!originalData) {
    return null
  }

  // Сбрасываем на оригинальные значения (сохраняем isDefault текущий)
  const { name: _name, isBuiltIn: _isBuiltIn, isDefault: _isDefault, ...resetData } = originalData

  return prisma.encodingProfile.update({
    where: { id },
    data: resetData,
  })
}

// === DUPLICATE ===

/**
 * Дублировать профиль (для создания на основе существующего)
 */
export async function duplicateEncodingProfile(id: string, newName?: string): Promise<EncodingProfile> {
  const source = await prisma.encodingProfile.findUnique({ where: { id } })

  if (!source) {
    throw new Error('Исходный профиль не найден')
  }

  // Создаём копию без id, timestamps и флагов встроенного/по умолчанию
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    isBuiltIn: _isBuiltIn,
    isDefault: _isDefault,
    ...profileData
  } = source

  return prisma.encodingProfile.create({
    data: {
      ...profileData,
      name: newName ?? `${source.name} (копия)`,
      isBuiltIn: false,
      isDefault: false,
    },
  })
}
