'use client'

import type { ReactElement } from 'react'

/**
 * Состояние загрузки для формы с API.
 * Отображается пока данные загружаются в режиме редактирования.
 * Не рендерит children, чтобы избежать ошибок контекста в Field компонентах.
 */
export function FormLoadingState(): ReactElement {
  return (
    <div style={{ opacity: 0.5, padding: '1rem' }}>
      <p>Загрузка данных формы...</p>
    </div>
  )
}
