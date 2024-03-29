// @ts-check
import { syncRecordings, parseEnv } from 'highrise-slack-sync'
import debug from 'debug'

debug.enable('highrise-slack:*')
const log = debug('highrise-slack:worker')

/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

/**
 * @typedef {object} Env
 * @property {KVNamespace} HIGHRISE_SYNC_KV
 * @property {string} HIGHRISE_TOKEN
 * @property {string} HIGHRISE_URL
 * @property {string} SLACK_URL
 * @property {string} HIGHRISE_GROUPS
 * @property {string} EVERYONE
 * @property {string} [ENVIRONMENT]
 */

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7

// Polyfill for setImmediate, used by deps but not available in Cloudflare workers
// @ts-ignore
self.setImmediate = fn => setTimeout(fn, 0)

/** @param {Env} env */
async function handleScheduledEvent (env) {
  console.log(env)
  console.log(typeof env.HIGHRISE_TOKEN)
  const syncOptions = parseEnv(env)
  const key = (env.ENVIRONMENT || 'testing') + 'LastCheck'
  log('KV key for previous sync:', key)
  const previousSync = await env.HIGHRISE_SYNC_KV.get(key)
  const syncSinceDate = new Date(previousSync || Date.now() - ONE_WEEK)
  const syncedUntil = await syncRecordings(syncSinceDate, { ...syncOptions, requestLimit: 50 })
  if (syncedUntil.toISOString() !== previousSync) {
    await env.HIGHRISE_SYNC_KV.put(key, syncedUntil.toISOString())
  }
}

export default {
  /**
   * @param {ScheduledController} controller
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled (controller, env, ctx) {
    ctx.waitUntil(handleScheduledEvent(env))
  }
}
