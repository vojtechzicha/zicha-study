"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import "@/app/study-note-content.css"

interface StudyNoteContentProps {
  slug: string
  studyId: string
  flush?: boolean
  onCacheInfo?: (_info: { onedriveLastModified?: string; generatedAt?: string }) => void
}

export function StudyNoteContent({ slug, studyId, flush, onCacheInfo }: StudyNoteContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [, setCacheKey] = useState<string | null>(null)
  const [, setTitle] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const katexLoadedRef = useRef(false)

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const url = `/api/study-notes/${slug}/convert?studyId=${studyId}${flush ? '&flush=1' : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Nepodařilo se načíst zápis.")
      }

      const data = await response.json()
      setCacheKey(data.cacheKey)

      if (onCacheInfo) {
        onCacheInfo({
          onedriveLastModified: data.onedriveLastModified,
          generatedAt: data.generatedAt
        })
      }

      if (data.title) {
        setTitle(data.title)
        document.title = `${data.title} – Studijní zápis`
      }

      let processedHtml = data.html
      if (data.mediaPath) {
        processedHtml = processedHtml.replace(
          /src="([^"]*media\/[^"]+)"/g,
          (match: string, path: string) => {
            // Keep only the `media/<file>` part, dropping any absolute prefix
            const mediaPath = path.includes('media/') ? path.substring(path.indexOf('media/')) : path
            return `src="/api/study-notes/${slug}/media/${mediaPath}?studyId=${studyId}&key=${data.cacheKey}"`
          }
        )
      }

      setContent(processedHtml)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst zápis.")
    } finally {
      setLoading(false)
    }
  }, [slug, studyId, flush, onCacheInfo])

  useEffect(() => {
    fetchContent()
  }, [slug, studyId, flush, fetchContent])

  useEffect(() => {
    if (!content || !contentRef.current) return

    const loadKatexAndRender = async () => {
      if (!document.getElementById("katex-css")) {
        const katexCSS = document.createElement("link")
        katexCSS.id = "katex-css"
        katexCSS.rel = "stylesheet"
        katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
        katexCSS.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV"
        katexCSS.crossOrigin = "anonymous"
        document.head.appendChild(katexCSS)
      }

      if (!katexLoadedRef.current) {
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"
        script.integrity = "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8"
        script.crossOrigin = "anonymous"
        
        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })

        const autoRenderScript = document.createElement("script")
        autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
        autoRenderScript.integrity = "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        autoRenderScript.crossOrigin = "anonymous"
        
        await new Promise((resolve, reject) => {
          autoRenderScript.onload = () => {
            resolve(undefined)
          }
          autoRenderScript.onerror = reject
          document.head.appendChild(autoRenderScript)
        })

        katexLoadedRef.current = true
      }

      // Give the freshly loaded scripts time to initialize
      await new Promise(resolve => setTimeout(resolve, 100))

      if (window.renderMathInElement && contentRef.current) {
        window.renderMathInElement(contentRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\begin{equation}", right: "\\end{equation}", display: true },
            { left: "\\begin{align}", right: "\\end{align}", display: true },
            { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
            { left: "\\begin{gather}", right: "\\end{gather}", display: true },
            { left: "\\begin{CD}", right: "\\end{CD}", display: true }
          ],
          throwOnError: false,
          errorColor: "hsl(0 72% 55%)",
          strict: false,
          trust: true,
          macros: {
            "\\eqref": "\\href{#1}{}",
            "\\ref": "\\href{#1}{}",
            "\\label": "\\htmlId{#1}{}"
          }
        })
      }

      // Fallback for Pandoc-style `span.math` elements that auto-render missed
      if (window.katex && contentRef.current) {
        const mathSpans = contentRef.current.querySelectorAll('span.math')
        mathSpans.forEach(span => {
          const mathText = span.textContent || ''
          if (mathText && !span.querySelector('.katex')) {
            try {
              const isDisplay = span.classList.contains('display')
              const rendered = window.katex.renderToString(mathText, {
                displayMode: isDisplay,
                throwOnError: false
              })
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = rendered
              span.replaceWith(tempDiv.firstChild!)
            } catch (e) {
              console.error('KaTeX error:', e)
            }
          }
        })
      }

      setupTocNavigation()
      
      if (contentRef.current) {
        const toggleBtn = contentRef.current.querySelector('.toc-toggle')
        const toc = contentRef.current.querySelector('.study-note-toc')
        
        if (toggleBtn && toc) {
          const handleToggle = () => {
            toc.classList.toggle('collapsed')
            const isCollapsed = toc.classList.contains('collapsed')
            localStorage.setItem('study-note-toc-collapsed', isCollapsed.toString())
          }
          
          toggleBtn.addEventListener('click', handleToggle)
          
          const savedState = localStorage.getItem('study-note-toc-collapsed')
          if (savedState === 'true') {
            toc.classList.add('collapsed')
          }
          
          return () => {
            toggleBtn.removeEventListener('click', handleToggle)
          }
        }
      }
    }

    loadKatexAndRender()
  }, [content])

  const setupTocNavigation = () => {
    if (!contentRef.current) return

    const toc = contentRef.current.querySelector("#TOC")
    if (!toc) return

    const tocLinks = toc.querySelectorAll("a")
    const clickHandler = (e: Event) => {
      e.preventDefault()
      const link = e.currentTarget as HTMLAnchorElement
      const targetId = link.getAttribute("href")?.substring(1)
      if (targetId) {
        const target = document.getElementById(targetId)
        if (target) {
          // Offset for fixed header
          const offset = 80
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset
          window.scrollTo({ top: targetPosition, behavior: "smooth" })
        }
      }
    }

    tocLinks.forEach(link => {
      link.addEventListener("click", clickHandler)
    })

    const sections = contentRef.current.querySelectorAll("h1[id], h2[id], h3[id], h4[id]")
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove("active"))
          
          const activeLink = toc.querySelector(`a[href="#${entry.target.id}"]`)
          if (activeLink) {
            activeLink.classList.add("active")
            
            // Keep the active link centred in the ToC
            const tocContent = activeLink.closest(".toc-content")
            if (tocContent) {
              const linkRect = activeLink.getBoundingClientRect()
              const tocRect = tocContent.getBoundingClientRect()
              const linkRelativeTop = linkRect.top - tocRect.top + tocContent.scrollTop
              const linkHeight = linkRect.height
              const tocHeight = tocRect.height
              
              const targetScrollTop = linkRelativeTop - (tocHeight / 2) + (linkHeight / 2)
              
              tocContent.scrollTo({
                top: targetScrollTop,
                behavior: "smooth"
              })
            }
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    sections.forEach(section => observer.observe(section))

    return () => {
      tocLinks.forEach(link => {
        link.removeEventListener("click", clickHandler)
      })
      sections.forEach(section => observer.unobserve(section))
    }
  }

  if (loading) {
    return (
      <Card className="min-h-[600px] flex items-center justify-center">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Načítání zápisu…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!content) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Obsah zápisu není k dispozici.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="study-note-container">
      <div 
        ref={contentRef}
        className="study-note-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    renderMathInElement: (_element: HTMLElement, _options?: unknown) => void
    katex: {
      render: (_tex: string, _element: HTMLElement, _options?: unknown) => void
      renderToString: (_tex: string, _options?: unknown) => string
    }
  }
}