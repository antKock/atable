export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#EDE8E0] bg-gradient-to-b from-background to-[#EDE8E0]">
      {children}
    </div>
  )
}
