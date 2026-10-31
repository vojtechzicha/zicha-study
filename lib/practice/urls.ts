import { PRACTICE_ROUTE_SEGMENT } from "@/lib/constants"
import { getShareUrl } from "@/lib/utils/share-url"

// Links to practice pages for MCP results and upload responses (server side).
//   url     – the share form used in Todoist (https://fim.zicha.study/procvicovani/dmo/bfs in
//             production, where subdomain share URLs are on)
//   www_url – the path form on this deployment's origin
export function practiceLinks(origin: string, addressPrefix: string, moduleSlug: string, pageSlug?: string) {
  const segments = [addressPrefix, PRACTICE_ROUTE_SEGMENT, moduleSlug, ...(pageSlug ? [pageSlug] : [])]
  const share = getShareUrl(...segments)
  const wwwUrl = `${origin}/${segments.join("/")}`
  return { url: /^https?:\/\//.test(share) ? share : wwwUrl, www_url: wwwUrl }
}
