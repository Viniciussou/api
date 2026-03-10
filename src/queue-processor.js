import PQueue from 'p-queue'
import { createLogger } from './logger.js'
import { db } from './supabase.js'
import { sendMessage, getSession } from './session-manager.js'
import { sendWebhook, WebhookEvents } from './webhook.js'
import { config } from './config.js'

const logger = createLogger('queue-processor')

// Create a queue for each user to process dispatches
const userQueues = new Map()

// Main processing flag
let isProcessing = false
let processingInterval = null

/**
 * Get or create a queue for a user
 */
function getOrCreateUserQueue(userId) {
  if (!userQueues.has(userId)) {
    const queue = new PQueue({
      concurrency: config.queue.concurrency,
      interval: config.queue.intervalMs,
      intervalCap: 1
    })
    userQueues.set(userId, queue)
  }
  return userQueues.get(userId)
}

/**
 * Process a single queue item
 */
async function processQueueItem(item) {
  const { id, session_id, contact_id, message_content, user_id, attempts, max_attempts } = item
  const contact = item.contacts
  const session = item.whatsapp_sessions

  logger.info({ queueId: id, sessionId: session_id, contactPhone: contact?.phone }, 'Processing queue item')

  try {
    // Check if session is still connected
    const sock = await getSession(session_id)
    if (!sock || session?.status !== 'connected') {
      throw new Error('Session not connected')
    }

    // Check daily limit
    const dispatchConfig = await db.getDispatchConfig(user_id)
    if (session.daily_message_count >= dispatchConfig.messages_per_session_per_day) {
      logger.warn({ sessionId: session_id }, 'Daily limit reached for session')
      
      // Mark as failed and don't retry
      await db.updateQueueItem(id, {
        status: 'failed',
        error_message: 'Daily message limit reached',
        processed_at: new Date().toISOString()
      })
      return
    }

    // Check active hours
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute

    const [startHour, startMinute] = dispatchConfig.active_hours_start.split(':').map(Number)
    const [endHour, endMinute] = dispatchConfig.active_hours_end.split(':').map(Number)
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute

    if (currentTime < startTime || currentTime > endTime) {
      logger.info({ queueId: id }, 'Outside active hours, rescheduling')
      
      // Reschedule for next active period
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(startHour, startMinute, 0, 0)
      
      await db.updateQueueItem(id, {
        scheduled_at: tomorrow.toISOString()
      })
      return
    }

    // Check day of week
    const dayOfWeek = now.getDay()
    if (!dispatchConfig.days_of_week.includes(dayOfWeek)) {
      logger.info({ queueId: id, dayOfWeek }, 'Not an active day, rescheduling')
      
      // Find next active day
      let daysToAdd = 1
      while (!dispatchConfig.days_of_week.includes((dayOfWeek + daysToAdd) % 7)) {
        daysToAdd++
        if (daysToAdd > 7) break
      }
      
      const nextActiveDay = new Date(now)
      nextActiveDay.setDate(nextActiveDay.getDate() + daysToAdd)
      nextActiveDay.setHours(startHour, startMinute, 0, 0)
      
      await db.updateQueueItem(id, {
        scheduled_at: nextActiveDay.toISOString()
      })
      return
    }

    // Replace variables in message content
    let finalMessage = message_content
    if (contact?.custom_fields) {
      for (const [key, value] of Object.entries(contact.custom_fields)) {
        finalMessage = finalMessage.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
    }
    // Replace standard variables
    finalMessage = finalMessage.replace(/\{\{name\}\}/g, contact?.name || '')
    finalMessage = finalMessage.replace(/\{\{phone\}\}/g, contact?.phone || '')

    // Mark as processing
    await db.updateQueueItem(id, { status: 'processing' })

    // Send message
    const result = await sendMessage(session_id, contact.phone, finalMessage)

    // Mark as sent
    await db.updateQueueItem(id, {
      status: 'sent',
      processed_at: new Date().toISOString()
    })

    // Create dispatch log
    await db.createDispatchLog({
      user_id,
      queue_id: id,
      session_id,
      contact_id,
      contact_phone: contact.phone,
      contact_name: contact.name,
      sender_phone: session.phone_number,
      message_content: finalMessage,
      status: 'sent'
    })

    // Send webhook
    await sendWebhook(WebhookEvents.MESSAGE_SENT, session_id, {
      queue_id: id,
      message_id: result.wa_message_id,
      status: 'sent'
    })

    logger.info({ queueId: id, waMessageId: result.wa_message_id }, 'Queue item processed successfully')

    // Add random delay between messages (anti-ban)
    const delay = Math.floor(
      Math.random() * (dispatchConfig.max_delay_seconds - dispatchConfig.min_delay_seconds) + 
      dispatchConfig.min_delay_seconds
    ) * 1000
    
    await new Promise(resolve => setTimeout(resolve, delay))

  } catch (error) {
    logger.error({ error: error.message, queueId: id }, 'Failed to process queue item')

    const newAttempts = attempts + 1
    
    if (newAttempts >= max_attempts) {
      // Mark as failed
      await db.updateQueueItem(id, {
        status: 'failed',
        error_message: error.message,
        attempts: newAttempts,
        processed_at: new Date().toISOString()
      })

      // Create failure log
      await db.createDispatchLog({
        user_id,
        queue_id: id,
        session_id,
        contact_id,
        contact_phone: contact?.phone || '',
        contact_name: contact?.name || null,
        sender_phone: session?.phone_number || '',
        message_content,
        status: 'failed',
        error_message: error.message
      })
    } else {
      // Retry later
      const retryAt = new Date(Date.now() + config.queue.retryDelay)
      await db.updateQueueItem(id, {
        status: 'pending',
        attempts: newAttempts,
        scheduled_at: retryAt.toISOString()
      })
      logger.info({ queueId: id, retryAt }, 'Scheduled for retry')
    }
  }
}

/**
 * Process pending queue items
 */
async function processPendingItems() {
  if (isProcessing) return

  isProcessing = true

  try {
    // Get pending items from all users
    const items = await db.getPendingQueueItems(null, 50)
    
    if (items.length === 0) {
      return
    }

    logger.info({ count: items.length }, 'Processing pending queue items')

    // Group items by user
    const itemsByUser = new Map()
    for (const item of items) {
      if (!itemsByUser.has(item.user_id)) {
        itemsByUser.set(item.user_id, [])
      }
      itemsByUser.get(item.user_id).push(item)
    }

    // Process items for each user using their queue
    const promises = []
    for (const [userId, userItems] of itemsByUser) {
      const queue = getOrCreateUserQueue(userId)
      
      for (const item of userItems) {
        promises.push(queue.add(() => processQueueItem(item)))
      }
    }

    await Promise.allSettled(promises)

  } catch (error) {
    logger.error({ error: error.message }, 'Error processing queue')
  } finally {
    isProcessing = false
  }
}

/**
 * Start the queue processor
 */
export function startQueueProcessor() {
  logger.info('Starting queue processor')
  
  // Process immediately
  processPendingItems()
  
  // Then process every 5 seconds
  processingInterval = setInterval(processPendingItems, 5000)
}

/**
 * Stop the queue processor
 */
export function stopQueueProcessor() {
  logger.info('Stopping queue processor')
  
  if (processingInterval) {
    clearInterval(processingInterval)
    processingInterval = null
  }

  // Clear all user queues
  for (const queue of userQueues.values()) {
    queue.clear()
  }
  userQueues.clear()
}

/**
 * Trigger processing for a specific user
 */
export function triggerProcessing(userId) {
  logger.info({ userId }, 'Triggered queue processing')
  processPendingItems()
}
