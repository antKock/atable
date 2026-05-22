import { Toaster } from '@/components/ui/sonner'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'

export default function FullscreenShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeviceTokenProvider />
      <main className="min-h-screen" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {children}
      </main>
      <Toaster />
    </>
  )
}
