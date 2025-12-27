import type { Request, Response, NextFunction } from 'express'

const AUTH_COOKIE_NAME = 'auth_token'

export const getAuthToken = (req: Request): string | undefined => {
  return req.cookies?.[AUTH_COOKIE_NAME]
}

export const requireAuth = (secret: string | undefined) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!secret) {
      res.status(500).send('Authentication not configured')
      return
    }

    const token = getAuthToken(req)
    if (!token || token !== secret) {
      res.status(401).send('Unauthorized')
      return
    }

    next()
  }
}
