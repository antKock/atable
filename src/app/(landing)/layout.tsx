export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen flex-col bg-page-gradient"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {children}
    </div>
  )
}
