export const runtime = 'edge'

import { redirect } from 'next/navigation'

type SubCategoryItemsPageProps = {
  params: Promise<{ id?: string; subId?: string }>
}

export default async function SubCategoryItemsPage({ params }: SubCategoryItemsPageProps) {
  const { id, subId } = await params

  if (!id || !subId) {
    redirect('/admin/sitelist')
  }

  redirect(
    `/admin/sitelist?categoryId=${encodeURIComponent(id)}&subCategoryId=${encodeURIComponent(subId)}`
  )
}
