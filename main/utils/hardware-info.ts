/**
 * Получение информации об оборудовании
 *
 * GPU — через nvidia-smi
 * CPU — через os.cpus()
 */

import { exec } from 'child_process'
import * as os from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)

/** Кэш для модели GPU */
let cachedGpuModel: string | null = null

/** Кэш для модели CPU */
let cachedCpuModel: string | null = null

/**
 * Получить модель GPU через nvidia-smi
 * Кэшируется после первого вызова
 */
export async function getGpuModel(): Promise<string | null> {
  if (cachedGpuModel !== null) {
    return cachedGpuModel || null
  }

  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader,nounits')
    const gpuName = stdout.trim().split('\n')[0]?.trim()
    if (gpuName) {
      cachedGpuModel = gpuName
      return cachedGpuModel
    }
    cachedGpuModel = ''
    return null
  } catch {
    cachedGpuModel = ''
    return null
  }
}

/**
 * Получить модель CPU
 * Кэшируется после первого вызова
 */
export function getCpuModel(): string {
  if (cachedCpuModel) {
    return cachedCpuModel
  }

  const cpus = os.cpus()
  if (cpus.length > 0) {
    // Убираем лишние пробелы и частоту (@ X.XXGHz)
    cachedCpuModel = cpus[0].model.replace(/\s+/g, ' ').trim()
    return cachedCpuModel
  }

  cachedCpuModel = 'Unknown CPU'
  return cachedCpuModel
}

/**
 * Получить модель оборудования по типу энкодера
 */
export async function getHardwareModel(encoderType: 'gpu' | 'cpu'): Promise<string> {
  if (encoderType === 'gpu') {
    const gpuModel = await getGpuModel()
    return gpuModel ?? 'Unknown GPU'
  }
  return getCpuModel()
}
