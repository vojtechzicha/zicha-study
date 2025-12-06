declare module 'xmldom' {
  export class DOMParser {
    parseFromString(source: string, mimeType: string): Document
  }
  export class XMLSerializer {
    serializeToString(node: Node): string
  }
}

declare module 'omml2mathml' {
  function omml2mathml(element: Element): HTMLElement
  export = omml2mathml
}

declare module 'mammoth' {
  export interface Image {
    read(): Promise<Buffer>
    contentType: string
  }

  export type ImageConverter = (image: Image) => Promise<{ src: string }>

  export interface Images {
    inline(converter: ImageConverter): ImageConverter
  }

  export const images: Images

  export namespace documents {
    interface Element {
      type: string
      children?: Element[]
      [key: string]: unknown
    }
  }

  export interface Options {
    convertImage?: ImageConverter
    styleMap?: string[]
    transformDocument?: (element: documents.Element) => documents.Element | null
  }

  export interface ConversionResult {
    value: string
    messages: unknown[]
  }

  export function convertToHtml(
    input: { buffer: Buffer } | { path: string },
    options?: Options
  ): Promise<ConversionResult>
}
