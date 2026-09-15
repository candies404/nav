import { getContentQualityReport } from '@/lib/content-quality'
import { ContentQualityClient } from './quality-client'

export const runtime = 'nodejs'

export default async function ContentQualityPage() {
  return <ContentQualityClient initialReport={await getContentQualityReport()} />
}
