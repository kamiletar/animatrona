/**
 * Навигация для Electron приложения
 *
 * В Electron + Next.js App Router при активном видео router.push()
 * может не триггерить rerender. Решение: используем history.pushState()
 * напрямую + popstate event для уведомления React Router.
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

let routerInstance: AppRouterInstance | null = null

/**
 * Установить инстанс роутера (вызывается из AppShell)
 */
export function setRouter(router: AppRouterInstance): void {
  routerInstance = router
}

/**
 * Навигация на указанный путь
 *
 * Использует history.pushState() + popstate event вместо router.push(),
 * так как router.push() игнорируется при активном видео в Electron.
 */
export function navigateTo(path: string): void {
  if (!routerInstance) {
    window.location.href = path
    return
  }

  const currentPath = window.location.pathname

  // Если уже на этом пути — только refresh
  if (currentPath === path) {
    routerInstance.refresh()
    return
  }

  try {
    // Используем history.pushState напрямую — обходит проблему с router.push()
    history.pushState(null, '', path)

    // Диспатчим popstate event чтобы Next.js App Router заметил изменение URL
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))

    // refresh() для полной перезагрузки контента
    routerInstance.refresh()
  } catch (error) {
    console.error('[Navigation] Error:', error)
    window.location.href = path
  }
}

/**
 * Проверка, находимся ли мы в Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}
