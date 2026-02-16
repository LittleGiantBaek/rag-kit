import { readFile } from 'node:fs/promises'

export interface MarkdownSection {
  readonly heading: string
  readonly level: number
  readonly content: string
}

export interface MarkdownParseResult {
  readonly sections: readonly MarkdownSection[]
  readonly metadata: {
    readonly sectionCount: number
    readonly hasTitle: boolean
  }
}

export interface MarkdownParser {
  readonly parse: (filePath: string) => Promise<MarkdownParseResult>
  readonly parseText: (filePath: string) => Promise<MarkdownParseResult>
}

function parseMarkdownContent(text: string): readonly MarkdownSection[] {
  const lines = text.split('\n')
  const sections: MarkdownSection[] = []

  let currentHeading = ''
  let currentLevel = 0
  let currentLines: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      // Flush previous section
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim()
        if (content.length > 0) {
          sections.push({
            heading: currentHeading,
            level: currentLevel,
            content,
          })
        }
      }

      currentHeading = headingMatch[2]
      currentLevel = headingMatch[1].length
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // Flush last section
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim()
    if (content.length > 0) {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        content,
      })
    }
  }

  // If no headings found, treat entire content as one section
  if (sections.length === 0 && text.trim().length > 0) {
    sections.push({
      heading: '',
      level: 0,
      content: text.trim(),
    })
  }

  return sections
}

function parseTextContent(text: string): readonly MarkdownSection[] {
  if (text.trim().length === 0) return []

  return [{
    heading: '',
    level: 0,
    content: text.trim(),
  }]
}

async function parseMarkdownFile(filePath: string): Promise<MarkdownParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const sections = parseMarkdownContent(content)

  return {
    sections,
    metadata: {
      sectionCount: sections.length,
      hasTitle: sections.length > 0 && sections[0].level === 1,
    },
  }
}

async function parseTextFile(filePath: string): Promise<MarkdownParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const sections = parseTextContent(content)

  return {
    sections,
    metadata: {
      sectionCount: sections.length,
      hasTitle: false,
    },
  }
}

export function createMarkdownParser(): MarkdownParser {
  return {
    parse: (filePath: string) => parseMarkdownFile(filePath),
    parseText: (filePath: string) => parseTextFile(filePath),
  }
}
