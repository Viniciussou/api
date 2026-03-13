import { app } from './api.js'
import { config } from './config.js'
import { logger } from './logger.js'
import { restoreSessions } from './session-manager.js'
import { startQueueProcessor, stopQueueProcessor } from './queue-processor.js'

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal')
  
  try {
    stopQueueProcessor()
    
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    logger.info('Shutdown complete')
  } catch (error) {
    logger.error({ error: error.message }, 'Error during shutdown')
  } finally {
    process.exit(0)
  }
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
  logger.error({ reason: String(reason), promise: String(promise) }, 'Unhandled promise rejection')
})

// Start server
async function start() {
  try {
    logger.info({ port: config.port, environment: process.env.NODE_ENV }, 'Starting Baileys WhatsApp Server...')
    
    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info({ port: config.port }, 'HTTP server started successfully')
    })

    // Restore existing sessions
    logger.info('Attempting to restore previous sessions...')
    await restoreSessions()

    // Start queue processor
    logger.info('Starting message queue processor...')
    startQueueProcessor()

    logger.info('Server startup complete - Ready to handle WhatsApp sessions')
  } catch (error) {
    logger.fatal({ error: error.message }, 'Failed to start server')
    process.exit(1)
  }
}

start()
