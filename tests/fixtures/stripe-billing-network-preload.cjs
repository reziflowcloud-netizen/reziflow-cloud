// Test-process adapter only, never imported by the application. Every outgoing
// Stripe SDK request is redirected to the loopback fixture; other network
// targets are blocked. Requires literal synthetic credentials and local QA DB.
const url = new URL(process.env.DATABASE_URL || 'http://invalid')
const port = Number(process.env.STRIPE_SYNTHETIC_PROVIDER_PORT)
if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/legalhub_billing_qa' ||
    process.env.STRIPE_SECRET_KEY !== 'sk_test_synthetic' || process.env.JWT_SECRET !== 'synthetic-billing-browser-secret' ||
    !Number.isInteger(port) || port < 1024) throw Error('Synthetic loopback Billing process only')
const http = require('node:http'), https = require('node:https')
const local = hostname => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname)
const httpRequest = http.request, httpsRequest = https.request
http.request = function (options, ...args) {
  const host = typeof options === 'string' || options instanceof URL ? new URL(options).hostname : options.hostname || options.host || 'localhost'
  if (!local(host)) throw Error('Synthetic process blocked remote HTTP')
  return httpRequest.call(this, options, ...args)
}
https.request = function (options, ...args) {
  const host = typeof options === 'string' || options instanceof URL ? new URL(options).hostname : options.hostname || options.host
  if (host === 'api.stripe.com' && typeof options === 'object' && !(options instanceof URL)) {
    return httpRequest.call(http, { ...options, host: '127.0.0.1', hostname: '127.0.0.1', port, protocol: 'http:', agent: undefined }, ...args)
  }
  if (!local(host)) throw Error('Synthetic process blocked remote HTTPS')
  return httpsRequest.call(this, options, ...args)
}
const originalFetch = globalThis.fetch
globalThis.fetch = function (input, ...args) {
  const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (!local(target.hostname)) throw Error('Synthetic process blocked remote fetch')
  return originalFetch(input, ...args)
}
