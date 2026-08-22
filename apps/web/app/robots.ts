import type { MetadataRoute } from 'next'
import { SITE_URL, BASE_PATH } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}${BASE_PATH}/sitemap.xml`,
  }
}
