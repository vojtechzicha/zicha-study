"use client"

import { useEffect } from "react"

export function useFavicon(logoUrl?: string | null) {
  useEffect(() => {
    // Get existing favicon elements or create them
    let linkElement = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    let appleTouchElement = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
    
    if (!linkElement) {
      linkElement = document.createElement('link')
      linkElement.rel = 'icon'
      linkElement.type = 'image/svg+xml'
      document.head.appendChild(linkElement)
    }
    
    if (!appleTouchElement) {
      appleTouchElement = document.createElement('link')
      appleTouchElement.rel = 'apple-touch-icon'
      document.head.appendChild(appleTouchElement)
    }

    if (logoUrl) {
      // Use study logo as favicon
      linkElement.href = logoUrl
      appleTouchElement.href = logoUrl
      linkElement.type = 'image/png' // Assume study logos are PNG/JPG
    } else {
      // Use default favicon
      linkElement.href = '/favicon.svg'
      appleTouchElement.href = '/favicon.svg'
      linkElement.type = 'image/svg+xml'
    }
  }, [logoUrl])
}