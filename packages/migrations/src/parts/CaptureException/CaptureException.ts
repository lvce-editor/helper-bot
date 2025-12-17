import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  })
}

export const captureException = (error: Error): void => {
  console.error(error)
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error)
  }
}
