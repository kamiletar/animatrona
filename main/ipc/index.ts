/**
 * Регистрация всех IPC handlers
 */

import { registerAchievementsHandlers } from './achievements.handlers'
import { registerAnimeManifestHandlers } from './anime-manifest.handlers'
import { registerAppHandlers } from './app.handlers'
import { registerBackupHandlers } from './backup.handlers'
import { registerBonusHandlers } from './bonus.handlers'
import { registerDeepLinkHandlers } from './deep-link.handlers'
import { registerDialogHandlers } from './dialog.handlers'
import { registerExportQueueHandlers } from './export-queue.handlers'
import { registerFederationHandlers } from './federation.handlers'
import { registerFFmpegHandlers } from './ffmpeg.handlers'
import { registerFranchiseHandlers } from './franchise.handlers'
import { registerFriendsHandlers } from './friends.handlers'
import { registerFsHandlers } from './fs.handlers'
import { registerHistoryHandlers } from './history.handlers'
import { registerImportQueueHandlers } from './import-queue.handlers'
import { registerIntroDetectorHandlers } from './intro-detector.handlers'
import { registerIpfsHandlers } from './ipfs.handlers'
import { registerLibraryHandlers } from './library.handlers'
import { registerManifestHandlers } from './manifest.handlers'
import { registerMobileServerHandlers } from './mobile-server.handlers'
import { registerParallelTranscodeHandlers } from './parallel-transcode.handlers'
import { registerPresenceHandlers } from './presence.handlers'
import { registerProfileHandlers } from './profile.handlers'
import { registerPublisherHandlers } from './publisher.handlers'
import { registerRemotePinHandlers } from './remote-pin.handlers'
import { registerReputationHandlers } from './reputation.handlers'
import { registerSchedulerHandlers } from './scheduler.handlers'
import { registerShikimoriHandlers } from './shikimori.handlers'
import { registerStatsHandlers } from './stats.handlers'
import { registerSubscriptionHandlers } from './subscription.handlers'
import { registerSubtitleHandlers } from './subtitle.handlers'
import { registerTemplatesHandlers } from './templates.handlers'
import { registerTrackerHandlers } from './tracker.handlers'
import { registerTranscodeQueueHandlers } from './transcode.handlers'
import { registerTrayHandlers } from './tray.handlers'
import { registerUpdaterHandlers } from './updater.handlers'
import { registerVmafHandlers } from './vmaf.handlers'
import { registerWatchPartyHandlers } from './watch-party.handlers'
import { registerWebExportHandlers } from './web-export.handlers'
import { registerWindowHandlers } from './window.handlers'

/**
 * Регистрирует все IPC handlers
 */
export function registerIpcHandlers(): void {
  registerAchievementsHandlers()
  registerAnimeManifestHandlers()
  registerAppHandlers()
  registerBackupHandlers()
  registerBonusHandlers()
  registerDeepLinkHandlers()
  registerDialogHandlers()
  registerExportQueueHandlers()
  registerFederationHandlers()
  registerFFmpegHandlers()
  registerFranchiseHandlers()
  registerFriendsHandlers()
  registerFsHandlers()
  registerHistoryHandlers()
  registerImportQueueHandlers()
  registerIntroDetectorHandlers()
  registerIpfsHandlers()
  registerLibraryHandlers()
  registerManifestHandlers()
  registerMobileServerHandlers()
  registerParallelTranscodeHandlers()
  registerPresenceHandlers()
  registerProfileHandlers()
  registerPublisherHandlers()
  registerRemotePinHandlers()
  registerReputationHandlers()
  registerSchedulerHandlers()
  registerShikimoriHandlers()
  registerStatsHandlers()
  registerSubscriptionHandlers()
  registerSubtitleHandlers()
  registerTemplatesHandlers()
  registerTrackerHandlers()
  registerTranscodeQueueHandlers()
  registerTrayHandlers()
  registerUpdaterHandlers()
  registerVmafHandlers()
  registerWatchPartyHandlers()
  registerWebExportHandlers()
  registerWindowHandlers()
}
