import 'dotenv/config'

export const config = {
  // Server
  port: process.env.PORT || 3001,
  serverSecret: process.env.SERVER_SECRET || 'your-secret-key',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Webhook (Next.js app URL)
  webhookUrl: process.env.WEBHOOK_URL,
  webhookSecret: process.env.WEBHOOK_SECRET || process.env.SERVER_SECRET,
  
  // WhatsApp Settings
  whatsapp: {
    // Rate limiting
    maxMessagesPerMinute: 20,
    maxMessagesPerHour: 200,
    maxMessagesPerDay: 1000,
    
    // Delays (in milliseconds)
    minDelayBetweenMessages: 3000,
    maxDelayBetweenMessages: 8000,
    
    // Reconnection
    maxReconnectAttempts: 5,
    reconnectInterval: 5000,
    
    // Session cleanup
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Queue settings
  queue: {
    concurrency: 1, // Process one message at a time per session
    intervalMs: 1000,
    retryAttempts: 3,
    retryDelay: 5000,
  }
}

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}
