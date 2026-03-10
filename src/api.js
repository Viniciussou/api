import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { createLogger } from './logger.js'
import { config } from './config.js'
import { 
  initSession, 
  disconnectSession, 
  sendMessage, 
  getSession, 
  getSessionQRCode
} from './session-manager.js'
import { triggerProcessing } from './queue-processor.js'
import { db } from './supabase.js'

const logger = createLogger('api')

export const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (token !== config.serverSecret) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing authorization token' })
  }

  next()
}

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sessions: 0 // Temporarily return 0 since getAllSessions is not available
  })
})

// All other routes require auth
app.use(authMiddleware)

// ==========================================
// Session Routes
// ==========================================

// Get all sessions status
app.get('/api/sessions', (req, res) => {
  // Temporarily return empty array since getAllSessions is not available
  res.json({ success: true, data: [] })
})

// Get single session status
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sock = await getSession(id)
    
    if (!sock) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' })
    }

    res.json({ 
      success: true, 
      data: {
        id,
        connected: !!sock.user,
        user: sock.user
      }
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting session')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Get QR code for a session
app.get('/api/sessions/:id/qr', (req, res) => {
  try {
    const { id } = req.params
    const qrCode = getSessionQRCode(id)
    
    if (qrCode) {
      res.json({ success: true, qr_code: qrCode })
    } else {
      res.json({ success: true, qr_code: null })
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting QR code')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Initialize/Connect session
app.post('/api/sessions/init', async (req, res) => {
  try {
    const { session_id, user_id } = req.body

    if (!session_id || !user_id) {
      return res.status(400).json({ error: 'Validation error', message: 'session_id and user_id are required' })
    }

    await initSession(session_id, user_id)
    
    res.json({ success: true, message: 'Session initialization started' })
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing session')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Connect session (generate QR)
app.post('/api/sessions/connect', async (req, res) => {
  try {
    const { user_id, phone_number } = req.body

    if (!user_id || !phone_number) {
      return res.status(400).json({ error: 'Validation error', message: 'user_id and phone_number are required' })
    }

    // Generate a session ID
    const sessionId = randomUUID()

    // Initialize the session
    await initSession(sessionId, user_id)
    
    // Wait a bit for QR to be generated
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Get QR code from memory
    const qrCode = getSessionQRCode(sessionId)
    
    // For now, return mock data since DB is not working
    res.json({ 
      success: true, 
      data: {
        session_id: sessionId,
        status: qrCode ? 'connecting' : 'connecting',
        qr_code: qrCode || null
      }
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Error connecting session')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Disconnect session
app.post('/api/sessions/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params
    
    await disconnectSession(id)
    
    res.json({ success: true, message: 'Session disconnected' })
  } catch (error) {
    logger.error({ error: error.message }, 'Error disconnecting session')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// ==========================================
// Message Routes
// ==========================================

// Send a single message
app.post('/api/messages/send', async (req, res) => {
  try {
    const { session_id, to, message, media_url, message_db_id } = req.body

    if (!session_id || !to || !message) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'session_id, to, and message are required' 
      })
    }

    const result = await sendMessage(session_id, to, message, { 
      mediaUrl: media_url 
    })

    // Update database message if provided
    if (message_db_id) {
      await db.updateMessage(message_db_id, {
        message_id: result.wa_message_id,
        status: 'sent'
      })
    }

    res.json({ 
      success: true, 
      data: {
        wa_message_id: result.wa_message_id,
        timestamp: result.timestamp
      }
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Error sending message')
    res.status(500).json({ error: 'Send error', message: error.message })
  }
})

// ==========================================
// Dispatch Routes
// ==========================================

// Trigger dispatch processing
app.post('/api/dispatch/process', (req, res) => {
  const { user_id } = req.body
  
  triggerProcessing(user_id)
  
  res.json({ success: true, message: 'Dispatch processing triggered' })
})

// ==========================================
// Utility Routes
// ==========================================

// Check if number exists on WhatsApp
app.post('/api/check-number', async (req, res) => {
  try {
    const { session_id, phone } = req.body

    if (!session_id || !phone) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'session_id and phone are required' 
      })
    }

    const sock = await getSession(session_id)
    if (!sock) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' })
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
    const [result] = await sock.onWhatsApp(jid)

    res.json({ 
      success: true, 
      data: {
        exists: result?.exists || false,
        jid: result?.jid
      }
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Error checking number')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Get profile picture
app.get('/api/profile-picture', async (req, res) => {
  try {
    const { session_id, phone } = req.query

    if (!session_id || !phone) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'session_id and phone are required' 
      })
    }

    const sock = await getSession(session_id)
    if (!sock) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' })
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
    const url = await sock.profilePictureUrl(jid, 'image').catch(() => null)

    res.json({ 
      success: true, 
      data: { url }
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting profile picture')
    res.status(500).json({ error: 'Server error', message: error.message })
  }
})

// Error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error')
  res.status(500).json({ error: 'Server error', message: 'An unexpected error occurred' })
})
