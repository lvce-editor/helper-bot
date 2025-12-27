import { join } from 'path'

const __dirname = import.meta.dirname

const root = join(__dirname, '..', '..', '..')

export const execWorkerUrl = join(root, 'packages', 'exec-worker', 'dist', 'src', 'index.js')

export const execWorkerUrlDev = join(root, 'packages', 'exec-worker', 'src', 'index.ts')
