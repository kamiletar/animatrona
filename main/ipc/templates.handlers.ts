/* eslint-disable no-console */
/**
 * IPC handlers для шаблонов импорта
 */

import { ipcMain } from 'electron'

import type { ImportTemplateCreateData, ImportTemplateUpdateData } from '../../shared/types/import-template'
import * as templatesStore from '../services/templates-store'

/**
 * Регистрация IPC handlers для шаблонов
 */
export function registerTemplatesHandlers(): void {
  // Получить все шаблоны
  ipcMain.handle('templates:getAll', async () => {
    try {
      const userTemplates = templatesStore.getAllTemplates()
      const defaultTemplates = templatesStore.getDefaultTemplates()
      return {
        success: true,
        data: [...defaultTemplates, ...userTemplates],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить шаблон по ID
  ipcMain.handle('templates:getById', async (_event, id: string) => {
    try {
      // Сначала ищем в дефолтных
      const defaultTemplates = templatesStore.getDefaultTemplates()
      const defaultTemplate = defaultTemplates.find((t) => t.id === id)
      if (defaultTemplate) {
        return { success: true, data: defaultTemplate }
      }

      // Затем в пользовательских
      const template = templatesStore.getTemplateById(id)
      if (!template) {
        return { success: false, error: 'Шаблон не найден' }
      }
      return { success: true, data: template }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Создать шаблон
  ipcMain.handle('templates:create', async (_event, data: ImportTemplateCreateData) => {
    try {
      const template = templatesStore.createTemplate(data)
      return { success: true, data: template }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Обновить шаблон
  ipcMain.handle('templates:update', async (_event, id: string, data: ImportTemplateUpdateData) => {
    try {
      // Нельзя редактировать дефолтные шаблоны
      const defaultTemplates = templatesStore.getDefaultTemplates()
      if (defaultTemplates.some((t) => t.id === id)) {
        return { success: false, error: 'Нельзя редактировать встроенный шаблон' }
      }

      const template = templatesStore.updateTemplate(id, data)
      if (!template) {
        return { success: false, error: 'Шаблон не найден' }
      }
      return { success: true, data: template }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Удалить шаблон
  ipcMain.handle('templates:delete', async (_event, id: string) => {
    try {
      // Нельзя удалить дефолтные шаблоны
      const defaultTemplates = templatesStore.getDefaultTemplates()
      if (defaultTemplates.some((t) => t.id === id)) {
        return { success: false, error: 'Нельзя удалить встроенный шаблон' }
      }

      const deleted = templatesStore.deleteTemplate(id)
      if (!deleted) {
        return { success: false, error: 'Шаблон не найден' }
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Отметить шаблон как использованный
  ipcMain.handle('templates:markAsUsed', async (_event, id: string) => {
    try {
      templatesStore.markTemplateAsUsed(id)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  console.log('[IPC] Зарегистрированы handlers для шаблонов')
}
