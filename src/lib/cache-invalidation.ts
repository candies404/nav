import { revalidatePath } from 'next/cache'

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.warn(`Failed to revalidate ${path}:`, error)
    }
  }
}

export function revalidateNavigationContent() {
  revalidatePaths([
    '/api/home/navigation',
    '/api/navigation',
  ])
}

export function revalidateSiteContent() {
  revalidatePaths([
    '/api/home/site',
    '/api/site',
  ])
}
