import { config } from './config.js'
import { logger } from './logger.js'

/**
 * Send webhook event to the Next.js application
 */
export async function sendWebhook(event, sessionId, data) {
  if (!config.webhookUrl) {
    logger.warn('Webhook URL not configured, skipping webhook')
    return
  }

  const payload = {
    event,
    session_id: sessionId,
    data,
    timestamp: new Date().toISOString()
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.webhookSecret}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      logger.error({ event, sessionId, status: response.status }, 'Webhook request failed')
    } else {
      logger.debug({ event, sessionId }, 'Webhook sent successfully')
    }
  } catch (error) {
    logger.error({ error: error.message, event, sessionId }, 'Failed to send webhook')
  }
}

// Webhook event types
export const WebhookEvents = {
  SESSION_CONNECTED: 'session.connected',
  SESSION_DISCONNECTED: 'session.disconnected',
  SESSION_QR_UPDATE: 'session.qr_update',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read'
}
