// Force dynamic rendering for all demo routes
// This prevents static generation which was causing revalidate() errors
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

