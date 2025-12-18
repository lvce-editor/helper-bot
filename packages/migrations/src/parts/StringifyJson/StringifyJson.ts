export const stringifyJson = (value: any): string => {
  return JSON.stringify(value, null, 2) + '\n'
}
