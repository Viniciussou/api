import { app } from './api.js'
import { config } from './config.js'
import { logger } from './logger.js'
import { restoreSessions } from './session-manager.js'
import { startQueueProcessor, stopQueueProcessor } from './queue-processor.js'

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal')
  
  stopQueueProcessor()
  
  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  logger.info('Shutdown complete')
  process.exit(0)
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection')
})

// Start server
async function start() {
  try {
    logger.info('Starting Baileys WhatsApp Server...')
    
    // Start HTTP server
    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'HTTP server started')
    })

    // Restore existing sessions
    await restoreSessions()

    // Start queue processor
    startQueueProcessor()

    logger.info('Server started successfully')
  } catch (error) {
    logger.fatal({ error: error.message }, 'Failed to start server')
    process.exit(1)
  }
}

start()
