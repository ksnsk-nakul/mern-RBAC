import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { retryFailedDeliveries } from './services/webhooks.service.js'

async function main() {
  await connectDB()
  retryFailedDeliveries().catch(() => {})
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`)
  })
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
