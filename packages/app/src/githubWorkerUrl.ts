import { join } from 'path'

const __dirname = import.meta.dirname

const root = join(__dirname, '..', '..', '..')

export const githubWorkerUrl = join(root, 'packages', 'github-worker', 'dist', 'src', 'index.js')

export const githubWorkerUrlDev = join(root, 'packages', 'github-worker', 'src', 'index.ts')
