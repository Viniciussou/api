import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import { createLogger } from './logger.js'
import { db } from './supabase.js'
import { sendWebhook, WebhookEvents } from './webhook.js'
import { config } from './config.js'
import fs from 'fs'
import path from 'path'

const logger = createLogger('session-manager')

// Store for all active sessions
const sessions = new Map()
const sessionStores = new Map()

// Sessions directory
const SESSIONS_DIR = './sessions'

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

/**
 * Get or create a session
 */
export async function getSession(sessionId) {
  return sessions.get(sessionId)
}

/**
 * Get all active sessions
 */
export function getAllSessions() {
  return Array.from(sessions.entries()).map(([id, sock]) => ({
    id,
    connected: sock?.user ? true : false,
    user: sock?.user
  }))
}

/**
 * Initialize a WhatsApp session
 */
export async function initSession(sessionId, userId) {
  logger.info({ sessionId, userId }, 'Initializing session')

  // Check if session already exists
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'Session already exists')
    return sessions.get(sessionId)
  }

  const sessionPath = path.join(SESSIONS_DIR, sessionId)

  // Create session directory if it doesn't exist
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true })
  }

  try {
    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    // Create store
    sessionStores.set(sessionId, store)

    // Get latest Baileys version
    const { version } = await fetchLatestBaileysVersion()

    // Create socket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: createLogger('baileys'),
      browser: ['GestorDisparo', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async (key) => {
        const msg = await store.loadMessage(key.remoteJid, key.id)
        return msg?.message || undefined
      }
    })

    // Bind store to socket
    store.bind(sock.ev)

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        logger.info({ sessionId }, 'QR code received')

        // Generate QR code as base64 image
        const qrBase64 = await QRCode.toDataURL(qr)

        // Update database with QR code
        await db.updateSession(sessionId, {
          qr_code: qrBase64,
          status: 'connecting'
        })

        // Send webhook
        await sendWebhook(WebhookEvents.SESSION_QR_UPDATE, sessionId, { qr_code: qrBase64 })
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode || 0
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        logger.info({ sessionId, statusCode, shouldReconnect }, 'Connection closed')

        // Update database
        await db.updateSession(sessionId, {
          status: statusCode === DisconnectReason.loggedOut ? 'disconnected' : 'connecting',
          qr_code: null
        })

        // Send webhook
        await sendWebhook(WebhookEvents.SESSION_DISCONNECTED, sessionId, {
          reason: statusCode,
          will_reconnect: shouldReconnect
        })

        // Remove from sessions map
        sessions.delete(sessionId)
        sessionStores.delete(sessionId)

        // Reconnect if needed
        if (shouldReconnect) {
          logger.info({ sessionId }, 'Attempting reconnection...')
          setTimeout(() => {
            initSession(sessionId, userId)
          }, config.whatsapp.reconnectInterval)
        } else {
          // Clear session files if logged out
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
          }
        }
      }

      if (connection === 'open') {
        logger.info({ sessionId, user: sock.user }, 'Connection opened')

        // Update database
        await db.updateSession(sessionId, {
          status: 'connected',
          qr_code: null,
          phone_number: sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0]
        })

        // Send webhook
        await sendWebhook(WebhookEvents.SESSION_CONNECTED, sessionId, {
          user: sock.user
        })
      }
    })

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds)

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        // Skip status updates and own messages
        if (msg.key.remoteJid === 'status@broadcast') continue
        if (msg.key.fromMe) continue

        const remoteJid = msg.key.remoteJid
        const messageContent = extractMessageContent(msg)

        if (!messageContent) continue

        logger.info({ sessionId, from: remoteJid }, 'Message received')

        // Get session to find user_id
        const session = await db.getSession(sessionId)
        if (!session) continue

        // Send webhook
        await sendWebhook(WebhookEvents.MESSAGE_RECEIVED, sessionId, {
          remote_jid: remoteJid,
          message_id: msg.key.id,
          content: messageContent.text,
          media_url: messageContent.mediaUrl,
          media_type: messageContent.mediaType,
          sender_name: msg.pushName,
          timestamp: msg.messageTimestamp
        })
      }
    })

    // Handle message status updates
    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update.status) {
          const status = update.update.status
          let eventType = null

          if (status === 3) eventType = WebhookEvents.MESSAGE_DELIVERED
          else if (status === 4) eventType = WebhookEvents.MESSAGE_READ

          if (eventType) {
            await sendWebhook(eventType, sessionId, {
              message_id: update.key.id,
              remote_jid: update.key.remoteJid
            })
          }
        }
      }
    })

    // Store session
    sessions.set(sessionId, sock)

    return sock
  } catch (error) {
    logger.error({ error: error.message, sessionId }, 'Failed to initialize session')
    throw error
  }
}

/**
 * Disconnect a session
 */
export async function disconnectSession(sessionId) {
  logger.info({ sessionId }, 'Disconnecting session')

  const sock = sessions.get(sessionId)
  if (sock) {
    await sock.logout()
    sessions.delete(sessionId)
    sessionStores.delete(sessionId)
  }

  // Clear session files
  const sessionPath = path.join(SESSIONS_DIR, sessionId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
  }

  // Update database
  await db.updateSession(sessionId, {
    status: 'disconnected',
    qr_code: null,
    auth_state: null
  })
}

/**
 * Send a message
 */
export async function sendMessage(sessionId, to, content, options = {}) {
  const sock = sessions.get(sessionId)
  if (!sock) {
    throw new Error('Session not found or not connected')
  }

  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`

    let messageContent
    if (options.mediaUrl) {
      // Handle media messages
      const mediaType = options.mediaType || 'image'
      messageContent = {
        [mediaType]: { url: options.mediaUrl },
        caption: content
      }
    } else {
      // Text message
      messageContent = { text: content }
    }

    const result = await sock.sendMessage(jid, messageContent)

    logger.info({ sessionId, to: jid, messageId: result.key.id }, 'Message sent')

    // Increment daily message count
    await db.incrementDailyMessageCount(sessionId)

    return {
      success: true,
      wa_message_id: result.key.id,
      timestamp: result.messageTimestamp
    }
  } catch (error) {
    logger.error({ error: error.message, sessionId, to }, 'Failed to send message')
    throw error
  }
}

/**
 * Extract message content from Baileys message
 */
function extractMessageContent(msg) {
  const message = msg.message
  if (!message) return null

  let text = ''
  let mediaUrl = null
  let mediaType = null

  if (message.conversation) {
    text = message.conversation
  } else if (message.extendedTextMessage?.text) {
    text = message.extendedTextMessage.text
  } else if (message.imageMessage) {
    text = message.imageMessage.caption || ''
    mediaType = 'image'
  } else if (message.videoMessage) {
    text = message.videoMessage.caption || ''
    mediaType = 'video'
  } else if (message.audioMessage) {
    mediaType = 'audio'
  } else if (message.documentMessage) {
    text = message.documentMessage.fileName || ''
    mediaType = 'document'
  } else if (message.stickerMessage) {
    mediaType = 'sticker'
  }

  return { text, mediaUrl, mediaType }
}

/**
 * Restore sessions from database on startup
 */
export async function restoreSessions() {
  logger.info('Restoring active sessions...')

  try {
    const activeSessions = await db.getAllActiveSessions()

    for (const session of activeSessions) {
      try {
        await initSession(session.id, session.user_id)
        logger.info({ sessionId: session.id }, 'Session restored')
      } catch (error) {
        logger.error({ error: error.message, sessionId: session.id }, 'Failed to restore session')
      }
    }

    logger.info({ count: activeSessions.length }, 'Sessions restoration complete')
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to restore sessions')
  }
}
