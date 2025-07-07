"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StudyNoteContentProps {
  slug: string
}

export function StudyNoteContent({ slug }: StudyNoteContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [cacheKey, setCacheKey] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const katexLoadedRef = useRef(false)

  useEffect(() => {
    fetchContent()
  }, [slug])

  const fetchContent = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/study-notes/${slug}/convert`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to load study note")
      }

      const data = await response.json()
      setCacheKey(data.cacheKey)
      
      // Process HTML to update image URLs
      let processedHtml = data.html
      if (data.mediaPath) {
        // First, handle any absolute paths that Pandoc might have generated
        const tempDirPattern = new RegExp(`src="[^"]*?(media/[^"]+)"`, 'g')
        processedHtml = processedHtml.replace(tempDirPattern, (match, mediaPath) => {
          return `src="/api/study-notes/${slug}/media/${mediaPath}?key=${data.cacheKey}"`
        })
        
        // Also handle the case where it's just "media/"
        processedHtml = processedHtml.replace(
          /src="media\//g,
          `src="/api/study-notes/${slug}/media/media/`
        )
        
        // Ensure all media URLs have the cache key
        processedHtml = processedHtml.replace(
          /src="(\/api\/study-notes\/[^\/]+\/media\/[^"?]+)"/g,
          `src="$1?key=${data.cacheKey}"`
        )
        
        console.log("Processed image URLs with cache key:", data.cacheKey)
      }

      setContent(processedHtml)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!content || !contentRef.current) return

    const loadKatexAndRender = async () => {
      // Load KaTeX CSS if not already loaded
      if (!document.getElementById("katex-css")) {
        const katexCSS = document.createElement("link")
        katexCSS.id = "katex-css"
        katexCSS.rel = "stylesheet"
        katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
        katexCSS.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV"
        katexCSS.crossOrigin = "anonymous"
        document.head.appendChild(katexCSS)
      }

      // Load KaTeX JS if not already loaded
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

        // Load auto-render addon
        const autoRenderScript = document.createElement("script")
        autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
        autoRenderScript.integrity = "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        autoRenderScript.crossOrigin = "anonymous"
        
        await new Promise((resolve, reject) => {
          autoRenderScript.onload = () => {
            console.log("Auto-render script loaded")
            resolve(undefined)
          }
          autoRenderScript.onerror = reject
          document.head.appendChild(autoRenderScript)
        })

        katexLoadedRef.current = true
      }

      // Wait a bit for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 100))

      // Render math
      if (window.renderMathInElement && contentRef.current) {
        console.log("Rendering math with KaTeX...")
        
        // Also check for span.math elements that Pandoc might generate
        const mathElements = contentRef.current.querySelectorAll('.math, .katex-math, span.math, script[type="math/tex"]')
        console.log(`Found ${mathElements.length} math elements`)
        
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
          errorColor: "#cc0000",
          strict: false,
          trust: true,
          macros: {
            "\\eqref": "\\href{#1}{}",
            "\\ref": "\\href{#1}{}",
            "\\label": "\\htmlId{#1}{}"
          }
        })
        console.log("Math rendering complete")
      } else {
        console.warn("KaTeX not loaded or content not ready")
      }

      // Process Pandoc's math spans if auto-render didn't catch them
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

      // Set up ToC navigation if present
      setupTocNavigation()
      
      // Add mobile ToC toggle functionality
      if (window.innerWidth <= 1024 && contentRef.current) {
        const sidebar = contentRef.current.querySelector('.study-note-sidebar')
        if (sidebar) {
          sidebar.addEventListener('click', (e) => {
            if (e.target === sidebar || (e.target as HTMLElement).tagName === 'H2') {
              sidebar.classList.toggle('collapsed')
            }
          })
        }
      }
    }

    loadKatexAndRender()
  }, [content])

  const setupTocNavigation = () => {
    if (!contentRef.current) return

    const toc = contentRef.current.querySelector("#TOC")
    if (!toc) return

    // Add click handlers to ToC links
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

    // Set up scroll spy for active section highlighting
    const sections = contentRef.current.querySelectorAll("h1[id], h2[id], h3[id], h4[id]")
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Remove all active classes
          tocLinks.forEach(link => link.classList.remove("active"))
          
          // Add active class to current section's link
          const activeLink = toc.querySelector(`a[href="#${entry.target.id}"]`)
          if (activeLink) {
            activeLink.classList.add("active")
            
            // Ensure the active link is visible in the sidebar
            const sidebar = activeLink.closest(".study-note-sidebar")
            if (sidebar) {
              const linkRect = activeLink.getBoundingClientRect()
              const sidebarRect = sidebar.getBoundingClientRect()
              
              if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
                activeLink.scrollIntoView({ block: "center", behavior: "smooth" })
              }
            }
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    sections.forEach(section => observer.observe(section))

    // Cleanup function
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Načítám studijní zápis...</p>
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
        <AlertDescription>Obsah studijního zápisu není k dispozici.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div 
          ref={contentRef}
          className="study-note-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </CardContent>
    </Card>
  )
}

// Extend window type for KaTeX
declare global {
  interface Window {
    renderMathInElement: (element: HTMLElement, options?: any) => void
    katex: {
      render: (tex: string, element: HTMLElement, options?: any) => void
      renderToString: (tex: string, options?: any) => string
    }
  }
}