import { Toaster } from '@/components/ui/sonner'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'

export default function FullscreenShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeviceTokenProvider />
      <main className="min-h-screen">{children}</main>
      <Toaster />
    </>
  )
}
