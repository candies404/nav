import { getFileContent, getStoredLinkHealth } from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'
import { buildQualityItems, type LinkHealth, type QualityReport } from '@/lib/site-quality'

export async function readQualityNavigation() {
  return getFileContent('src/navsphere/content/navigation.json', {
    bypassCache: true, fallbackOnError: false,
  }) as Promise<NavigationData>
}

export async function getContentQualityReport(): Promise<QualityReport> {
  let healthWarning: string | undefined
  const [navigation, health] = await Promise.all([
    readQualityNavigation(),
    getStoredLinkHealth().catch(() => {
      healthWarning = '检测记录暂不可用，请检查系统状态后重试。下方仍展示缺失信息和重复网址。'
      return {} as Record<string, LinkHealth>
    }),
  ])
  return { items: buildQualityItems(navigation, health), healthWarning }
}
