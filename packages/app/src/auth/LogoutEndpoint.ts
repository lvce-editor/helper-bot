import type { Request, Response } from 'express'

const AUTH_COOKIE_NAME = 'auth_token'

export const handleLogout = (): ((req: Request, res: Response) => void) => {
  return (req: Request, res: Response): void => {
    res.clearCookie(AUTH_COOKIE_NAME)
    res.redirect('/my-app/login')
  }
}
