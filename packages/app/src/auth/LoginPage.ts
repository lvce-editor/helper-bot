import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let loginPageHtml: string | undefined

const getHtmlPath = (filename: string): string => {
  // Try current directory first (works if HTML files are copied to dist)
  const currentPath = join(__dirname, filename)
  if (existsSync(currentPath)) {
    return currentPath
  }
  // If we're in dist/auth, try src/auth (for development)
  if (__dirname.includes('dist')) {
    const srcPath = join(__dirname.replace('dist', 'src'), filename)
    if (existsSync(srcPath)) {
      return srcPath
    }
  }
  // Fallback to current directory
  return currentPath
}

export const getLoginPageHtml = (): string => {
  if (!loginPageHtml) {
    const htmlPath = getHtmlPath('login.html')
    loginPageHtml = readFileSync(htmlPath, 'utf-8')
  }
  return loginPageHtml
}
