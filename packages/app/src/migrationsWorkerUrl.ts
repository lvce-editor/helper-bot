import { join } from 'path'

const __dirname = import.meta.dirname

const root = join(__dirname, '..', '..', '..')

export const migrationsWorkerUrl = join(root, 'packages', 'migrations', 'dist', 'index.js')

export const migrationsWorkerUrlDev = join(root, 'packages', 'migrations', 'src', 'index.ts')
