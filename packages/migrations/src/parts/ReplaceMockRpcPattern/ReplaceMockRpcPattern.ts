export const replaceMockRpcPattern = (content: string): string => {
  return content
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trimStart()
      if (!trimmedLine.startsWith('const ') || !trimmedLine.includes('.registerMockRpc')) {
        return line
      }
      const assignment = trimmedLine.slice('const '.length)
      const equalsIndex = assignment.indexOf('=')
      if (equalsIndex === -1) {
        return line
      }
      const variableName = assignment.slice(0, equalsIndex).trim()
      if (!/^\w+$/.test(variableName)) {
        return line
      }
      const value = assignment.slice(equalsIndex + 1).trimStart()
      const indent = line.slice(0, line.length - trimmedLine.length)
      return `${indent}using ${variableName} = ${value}`
    })
    .join('\n')
}
