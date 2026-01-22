'use client'

/**
 * Компонент инициализации встроенных профилей
 *
 * Вызывает Server Action seed при первом монтировании.
 * Ничего не рендерит.
 */

import { useEffect, useRef } from 'react'
import { seedEncodingProfiles } from '@/app/_actions/encoding-profile.action'

export function InitProfiles() {
  const didInit = useRef(false)

  useEffect(() => {
    // Инициализируем только один раз
    if (didInit.current) {return}
    didInit.current = true

    seedEncodingProfiles().catch((error) => {
      console.error('[InitProfiles] Ошибка инициализации профилей:', error)
    })
  }, [])

  return null
}
