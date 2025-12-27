import type { Request, Response } from 'express'

const AUTH_COOKIE_NAME = 'auth_token'

export const handleLogin = (secret: string | undefined) => {
  return (req: Request, res: Response): void => {
    if (!secret) {
      res.status(500).json({ error: 'Authentication not configured' })
      return
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(400).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' })
      return
    }

    const providedToken = authHeader.slice(7) // Remove 'Bearer ' prefix

    if (providedToken !== secret) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Set HTTP-only secure cookie
    res.cookie(AUTH_COOKIE_NAME, providedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })

    res.status(200).json({ success: true, message: 'Login successful' })
  }
}
