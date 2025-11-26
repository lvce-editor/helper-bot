import { join } from 'node:path'

const __dirname = import.meta.dirname

export const root: string = join(__dirname, '..', '..', '..')
