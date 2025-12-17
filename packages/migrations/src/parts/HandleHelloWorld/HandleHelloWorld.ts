import { listCommands2 } from '../ListCommands2/ListCommands2.ts'

export const handleHelloWorld = async (): Promise<Response> => {
  const x = listCommands2()
  return Response.json({
    migrations: x,
  })
}
