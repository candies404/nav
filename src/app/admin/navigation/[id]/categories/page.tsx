import { redirect } from 'next/navigation'
import { getAdminNavigationCategories } from '@/lib/admin-read'
import { CategoriesClient } from './categories-client'

export const runtime = 'edge'

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const navigation = await getAdminNavigationCategories(id)

  if (!navigation) {
    redirect('/admin/navigation')
  }

  return (
    <CategoriesClient
      navigationId={id}
      initialNavigation={navigation}
    />
  )
}
