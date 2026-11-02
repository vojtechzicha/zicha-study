// Morphs a container's children into new HTML in place, so nodes that keep their place keep
// their identity and CSS transitions on them (fill, stroke, background) animate instead of
// the content being swapped. Nodes match by position, tag and namespace; anything else is
// replaced. Used by the tutorial player, whose frames share one SVG skeleton.
//
// Browser only. The HTML comes from sanitized practice content.

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false
  if (a.nodeType !== Node.ELEMENT_NODE) return true
  const ea = a as Element
  const eb = b as Element
  return ea.namespaceURI === eb.namespaceURI && ea.localName === eb.localName
}

function syncAttributes(target: Element, source: Element) {
  for (const { name } of [...target.attributes]) {
    if (!source.hasAttribute(name)) target.removeAttribute(name)
  }
  for (const { name, value } of [...source.attributes]) {
    if (target.getAttribute(name) !== value) target.setAttribute(name, value)
  }
}

function morphChildren(target: Node, source: Node) {
  const next = [...source.childNodes]
  const current = [...target.childNodes]
  next.forEach((node, i) => {
    const old = current[i]
    if (!old) {
      target.appendChild(node)
    } else if (!sameKind(old, node)) {
      target.replaceChild(node, old)
    } else if (old.nodeType === Node.ELEMENT_NODE) {
      syncAttributes(old as Element, node as Element)
      morphChildren(old, node)
    } else if (old.nodeValue !== node.nodeValue) {
      old.nodeValue = node.nodeValue
    }
  })
  for (const extra of current.slice(next.length)) target.removeChild(extra)
}

export function morphInnerHtml(container: Element, html: string) {
  const template = document.createElement("template")
  template.innerHTML = html
  morphChildren(container, template.content)
}
