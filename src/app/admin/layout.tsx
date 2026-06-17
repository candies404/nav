import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AdminLayoutClient } from './AdminLayoutClient'
import { Toaster } from "@/registry/new-york/ui/toaster"
import { Metadata } from 'next'

export const runtime = 'edge'


export const metadata: Metadata = {
  title: 'NavSphere Admin',
  description: 'NavSphere Admin Dashboard',
  icons: {
    icon: '/assets/images/favicon.webp',
    shortcut: '/assets/images/favicon.webp',
    apple: '/assets/images/favicon.webp',
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, requestHeaders] = await Promise.all([
    auth(),
    headers(),
  ])

  if (!session?.user) {
    const callbackUrl = getSafeAdminCallbackUrl(requestHeaders.get('x-navsphere-pathname'))
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return (
    <>
      <AdminLayoutClient
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }}
      >
        {children}
      </AdminLayoutClient>
      <Toaster />
    </>
  )
}

function getSafeAdminCallbackUrl(value: string | null) {
  if (!value || !value.startsWith('/admin') || value.startsWith('//')) {
    return '/admin'
  }

  return value
}
