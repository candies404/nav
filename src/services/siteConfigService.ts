import { SiteConfig } from '@/types/site'

export class SiteConfigService {
  async getSiteConfig(): Promise<SiteConfig> {
    try {
      const response = await fetch('/api/site')
      if (!response.ok) throw new Error('Failed to fetch site config')
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching site config:', error)
      return {
        basic: {
          title: '',
          description: '',
          keywords: ''
        },
        appearance: {
          logo: '',
          favicon: '',
          theme: 'system'
        },
        navigation: {
          linkTarget: '_blank'
        }
      }
    }
  }

  async updateSiteConfig(config: SiteConfig): Promise<void> {
    const response = await fetch('/api/site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || 'Failed to update site config')
    }
  }
}
