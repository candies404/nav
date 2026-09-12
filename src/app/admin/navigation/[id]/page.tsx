export const runtime = 'nodejs'

import { redirect } from 'next/navigation'

type NavigationPageProps = {
  params: Promise<{ id?: string }>
}

export default async function NavigationPage({ params }: NavigationPageProps) {
  const { id } = await params

  if (!id) {
    redirect('/admin/navigation')
  }

  redirect(`/admin/navigation/${encodeURIComponent(id)}/categories`)
}
