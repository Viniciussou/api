import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// Create Supabase client with service role key for admin access
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Helper functions for database operations
export const db = {
  // Sessions
  async getSession(sessionId) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    
    if (error) throw error
    return data
  },

  async getSessionByPhoneNumber(phoneNumber, userId) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  },

  async createSession(phoneNumber, userId, sessionName = null) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        phone_number: phoneNumber,
        user_id: userId || '550e8400-e29b-41d4-a716-446655440000', // Default user UUID
        session_name: sessionName,
        is_connected: false
      })
      .select()
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  async updateSession(sessionId, updates) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  async getAllActiveSessions() {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('is_connected', true)
    
    if (error) throw error
    return data || []
  },

  async incrementDailyMessageCount(sessionId) {
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('daily_message_count')
      .eq('id', sessionId)
      .single()

    await supabase
      .from('whatsapp_sessions')
      .update({ 
        daily_message_count: (session?.daily_message_count || 0) + 1,
        last_message_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  },

  // Queue
  async getPendingQueueItems(userId = null, limit = 10) {
    let query = supabase
      .from('dispatch_queue')
      .select(`
        *,
        contacts (phone, name, custom_fields),
        whatsapp_sessions (phone_number, name, status, daily_message_count)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async updateQueueItem(queueId, updates) {
    const { error } = await supabase
      .from('dispatch_queue')
      .update(updates)
      .eq('id', queueId)
    
    if (error) throw error
  },

  async createDispatchLog(log) {
    const { error } = await supabase
      .from('dispatch_logs')
      .insert(log)
    
    if (error) throw error
  },

  // Messages
  async saveMessage(message) {
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateMessage(messageId, updates) {
    const { error } = await supabase
      .from('messages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', messageId)
    
    if (error) throw error
  },

  // Contacts
  async findOrCreateContact(userId, phone, name = null) {
    // Try to find existing contact
    const { data: existing } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', phone)
      .maybeSingle()

    if (existing) {
      // Update last contact time
      await supabase
        .from('contacts')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', existing.id)
      return existing
    }

    // Create new contact
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        phone,
        name,
        status: 'active'
      })
      .select()
      .maybeSingle()

    if (error) throw error
    return newContact
  },

  // Config
  async getDispatchConfig(userId) {
    const { data } = await supabase
      .from('dispatch_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    return data || {
      messages_per_session_per_day: 30,
      min_delay_seconds: 10,
      max_delay_seconds: 60,
      active_hours_start: '08:00',
      active_hours_end: '20:00',
      days_of_week: [1, 2, 3, 4, 5],
      pause_on_response: true
    }
  }
}
