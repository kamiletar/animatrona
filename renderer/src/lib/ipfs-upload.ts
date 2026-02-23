/**
 * Утилиты для загрузки файлов в IPFS
 */

/**
 * Загрузить файл в IPFS и вернуть CID
 * @param filePath - Путь к файлу
 * @returns CID файла или null при ошибке
 */
export async function uploadToIpfs(filePath: string): Promise<string | null> {
  const api = window.electronAPI
  if (!api?.ipfs?.addFile) {
    console.warn('[uploadToIpfs] IPFS API not available')
    return null
  }

  try {
    const result = await api.ipfs.addFile(filePath)
    if (result.success && result.data?.cid) {
      console.log(`[uploadToIpfs] Uploaded ${filePath} → ${result.data.cid}`)
      return result.data.cid
    }
    console.warn(`[uploadToIpfs] Failed to upload ${filePath}:`, result.error)
    return null
  } catch (error) {
    console.error(`[uploadToIpfs] Error uploading ${filePath}:`, error)
    return null
  }
}

/**
 * Загрузить несколько файлов в IPFS параллельно
 * @param filePaths - Массив путей к файлам
 * @returns Массив CID (null для неудачных загрузок)
 */
export async function uploadManyToIpfs(filePaths: string[]): Promise<(string | null)[]> {
  return Promise.all(filePaths.map(uploadToIpfs))
}

/**
 * Загрузить файл в IPFS и вернуть CID, игнорируя ошибки
 * Удобно для опциональной загрузки (шрифты, субтитры)
 * @param filePath - Путь к файлу (может быть null/undefined)
 * @returns CID файла или undefined
 */
export async function tryUploadToIpfs(filePath: string | null | undefined): Promise<string | undefined> {
  if (!filePath) return undefined
  const cid = await uploadToIpfs(filePath)
  return cid ?? undefined
}
