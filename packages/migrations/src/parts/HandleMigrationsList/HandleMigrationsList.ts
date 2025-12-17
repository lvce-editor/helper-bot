import { listCommands2 } from '../ListCommands2/ListCommands2.ts'

export const handleMigrationsList = async () => {
  const migrations = listCommands2()
  return Response.json({
    migrations: migrations,
  })
}
