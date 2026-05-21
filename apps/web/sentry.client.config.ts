import * as Sentry from '@sentry/nextjs'
Sentry.init({
  dsn: 'https://a1d14ffe435bac269558e732ba6fd689@o4511169644986368.ingest.us.sentry.io/4511428401692672',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
