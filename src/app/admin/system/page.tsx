import { SystemStatusLazy } from './system-status-lazy'

export const runtime = 'nodejs'

export default function AdminSystemStatusPage() {
  return <SystemStatusLazy />
}
