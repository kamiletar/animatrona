/**
 * Регистрация всех IPC handlers
 */

import { registerAppHandlers } from './app.handlers'
import { registerBackupHandlers } from './backup.handlers'
import { registerDialogHandlers } from './dialog.handlers'
import { registerExportHandlers } from './export.handlers'
import { registerFFmpegHandlers } from './ffmpeg.handlers'
import { registerFranchiseHandlers } from './franchise.handlers'
import { registerFsHandlers } from './fs.handlers'
import { registerHistoryHandlers } from './history.handlers'
import { registerImportQueueHandlers } from './import-queue.handlers'
import { registerLibraryHandlers } from './library.handlers'
import { registerManifestHandlers } from './manifest.handlers'
import { registerParallelTranscodeHandlers } from './parallel-transcode.handlers'
import { registerShikimoriHandlers } from './shikimori.handlers'
import { registerSubtitleHandlers } from './subtitle.handlers'
import { registerTemplatesHandlers } from './templates.handlers'
import { registerTranscodeQueueHandlers } from './transcode.handlers'
import { registerTrayHandlers } from './tray.handlers'
import { registerUpdaterHandlers } from './updater.handlers'
import { registerVmafHandlers } from './vmaf.handlers'
import { registerWindowHandlers } from './window.handlers'

/**
 * Регистрирует все IPC handlers
 */
export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerBackupHandlers()
  registerDialogHandlers()
  registerExportHandlers()
  registerFFmpegHandlers()
  registerFranchiseHandlers()
  registerFsHandlers()
  registerHistoryHandlers()
  registerImportQueueHandlers()
  registerLibraryHandlers()
  registerManifestHandlers()
  registerParallelTranscodeHandlers()
  registerShikimoriHandlers()
  registerSubtitleHandlers()
  registerTemplatesHandlers()
  registerTranscodeQueueHandlers()
  registerTrayHandlers()
  registerUpdaterHandlers()
  registerVmafHandlers()
  registerWindowHandlers()
}
