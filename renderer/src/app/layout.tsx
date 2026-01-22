import { AppShell } from '@/components/layout/AppShell'
import { ImportQueueProcessor } from '@/components/transcode'
import { Provider } from '@/components/ui/provider'
import { Toaster } from '@/components/ui/toaster'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Animatrona',
  description: 'Медиаплеер и транскодер для аниме',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {/* SubtitlesOctopus для ASS субтитров */}
        <Script src="/subtitles-octopus.js" strategy="beforeInteractive" />
        <Provider>
          {/* Координатор обработки очереди — живёт всегда, не зависит от навигации */}
          <ImportQueueProcessor />
          <AppShell>{children}</AppShell>
          <Toaster />
        </Provider>
      </body>
    </html>
  )
}
