import { handleNode } from '../src/server/node-adapter'

export default function handler(
  req: Parameters<typeof handleNode>[0],
  res: Parameters<typeof handleNode>[1],
): Promise<void> {
  return handleNode(req, res)
}
