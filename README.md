# 🚀 API-Render - Baileys WhatsApp Server

Servidor robusto de WhatsApp usando Baileys com suporte a multi-sessões, fila de mensagens, e integração com Supabase.

## 📋 Sumário

- [Instalação](#instalação)
- [Configuração](#configuração)
- [Endpoints](#endpoints)
- [Estrutura de Código](#estrutura-de-código)
- [Segurança](#segurança)
- [Desenvolvimento](#desenvolvimento)
- [Deployment](#deployment)

---

## 🔧 Instalação

### Pré-requisitos
- Node.js >= 20.x
- npm ou pnpm
- Supabase account com credentials

### Passos

```bash
cd api-render
npm install
# ou
pnpm install
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` com as seguintes variáveis:

```env
# Server
PORT=3001
SERVER_SECRET=gestor-disparo-secret
NODE_ENV=production
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key

# Webhook (Frontend URL)
WEBHOOK_URL=https://seu-frontend.vercel.app/api/webhook/baileys
WEBHOOK_SECRET=gestor-disparo-secret
```

### Validação

As seguintes variáveis são obrigatórias:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Se faltarem, o servidor não iniciará.

---

## 🔌 Endpoints

Todos os endpoints POST requerem autenticação:
```
Authorization: Bearer {SERVER_SECRET}
Content-Type: application/json
```

### Sessions

#### **POST /api/connect** - Inicializar Sessão
```
Body:
{
  "session_id": "uuid",
  "user_id": "user-uuid",
  "phone_number": "5511999999999"
}

Response:
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "status": "connecting",
    "qr_code": "data:image/png;base64,..."
  }
}
```

#### **POST /api/disconnect** - Desconectar Sessão
```
Body:
{
  "session_id": "uuid"
}

Response:
{
  "success": true,
  "message": "Session disconnected"
}
```

### Messages

#### **POST /api/send** - Enviar Mensagem
```
Body:
{
  "session_id": "uuid",
  "to": "5511999999999@s.whatsapp.net",
  "message": "Olá!",
  "media_url": null,
  "message_db_id": "msg_123"
}

Response:
{
  "success": true,
  "data": {
    "wa_message_id": "123456789",
    "timestamp": "2024-03-13T10:30:00Z"
  }
}
```

### Dispatch

#### **POST /api/send-bulk** - Envio em Massa
```
Body:
{
  "session_ids": ["session1", "session2"],
  "contact_ids": ["contact1", "contact2"],
  "user_id": "user-uuid"
}

Response:
{
  "success": true,
  "message": "Bulk dispatch processing triggered",
  "data": {
    "session_ids": 2,
    "contact_ids": 2
  }
}
```

### Utility

#### **POST /api/check-number** - Verificar Número
```
Body:
{
  "session_id": "uuid",
  "phone": "5511999999999"
}

Response:
{
  "success": true,
  "data": {
    "exists": true,
    "jid": "5511999999999@s.whatsapp.net"
  }
}
```

#### **GET /api/profile-picture** - Foto de Perfil
```
Query:
?session_id=uuid&phone=5511999999999

Response:
{
  "success": true,
  "data": {
    "url": "https://..."
  }
}
```

### Status

#### **GET /health** - Health Check (sem autenticação)
```
Response:
{
  "status": "ok",
  "timestamp": "2024-03-13T10:30:00Z",
  "sessions": 0
}
```

---

## 🏗️ Estrutura de Código

```
src/
├── index.js                 # Entry point do servidor
├── config.js               # Configuração e validação de env vars
├── logger.js               # Sistema de logging (Pino)
├── api.js                  # Express app e rotas
├── session-manager.js      # Gerenciamento de sessões Baileys
├── queue-processor.js      # Processador de fila de mensagens
├── webhook.js              # Cliente de webhook
└── supabase.js             # Cliente e helpers do Supabase
```

### Principais Componentes

#### **session-manager.js**
- `initSession(sessionId, userId)` - Inicializa nova sessão WhatsApp
- `disconnectSession(sessionId)` - Desconecta sessão
- `sendMessage(sessionId, to, content, options)` - Envia mensagem
- `getSession(sessionId)` - Obtém socket da sessão
- `getSessionQRCode(sessionId)` - Obtém QR code gerado
- `restoreSessions()` - Restaura sessões ativas no startup

#### **queue-processor.js**
- Processa itens de fila de mensagens (`dispatch_queue`)
- Rate limiting entre mensagens
- Respeita horários ativos
- Suporta variáveis em mensagens
- Retry automático em caso de falha

#### **webhook.js**
- `sendWebhook(event, sessionId, data)` - Envia evento para frontend
- Eventos: SESSION_CONNECTED, MESSAGE_RECEIVED, MESSAGE_SENT, etc.

#### **supabase.js**
- Helpers para CRUD de sessões, mensagens, fila
- Gerenciamento de contatos
- Logs de dispatch
- Configurações de dispatch

---

## 🔒 Segurança

### Autenticação
- Todos os endpoints POST requerem header `Authorization: Bearer {SERVER_SECRET}`
- O servidor extrai e valida o token automaticamente
- Endpoints GET públicos (como `/health`) não requerem autenticação

### Validação
- Validação de parâmetros obrigatórios em cada rota
- Tratamento de erros com mensagens apropriadas
- Logging estruturado de segurança

### CORS
- CORS habilitado para todos os origins
- Configure conforme necessário em produção

---

## 🚀 Desenvolvimento

### Rodar Localmente

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

### Logging
- Nível de log configurável via `LOG_LEVEL`
- Produção: JSON estruturado
- Desenvolvimento: Pretty-print com cores

### Debug

Para logs mais detalhados:
```bash
LOG_LEVEL=debug npm start
```

---

## 🌐 Deployment

### Render.com

1. **Conecte seu repositório Git**
   - Fork/Push para GitHub
   - Conecte no Render Dashboard

2. **Configure Variáveis de Ambiente**
   ```
   SERVER_SECRET=gestor-disparo-secret
   PORT=3001
   NODE_ENV=production
   LOG_LEVEL=info
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   WEBHOOK_URL=https://seu-frontend.vercel.app/api/webhook/baileys
   WEBHOOK_SECRET=gestor-disparo-secret
   ```

3. **Build Command**
   ```
   npm install
   ```

4. **Start Command**
   ```
   npm start
   ```

5. **Deploy**
   - Render detecta mudanças em `main` automaticamente
   - Redeploy automático a cada push

### Health Check
- Render pode monitorar `/health`
- URL: `https://seu-api.onrender.com/health`

---

## 📊 Fluxo de Funcionamento

### 1. Conexão WhatsApp
```
Frontend POST /api/sessions [id]/connect
  ↓
Backend POST https://api-render.com/api/connect
  ↓
Baileys gera QR code na memória
  ↓
User escaneia com WhatsApp
  ↓
Baileys autentica
  ↓
Webhook POST /api/webhook/baileys (event: session.authenticated)
  ↓
Frontend atualiza UI
```

### 2. Enviar Mensagem
```
Frontend POST /api/messages
  ↓
Backend verifica sessão conectada
  ↓
Backend POST https://api-render.com/api/send
  ↓
Baileys envia via WhatsApp
  ↓
Update database com status "sent"
  ↓
Response com wa_message_id
```

### 3. Processamento de Fila
```
Queue Item criado com status "pending"
  ↓
Queue Processor verifica a cada 5s
  ↓
Valida: horários ativos, limite de mensagens, dias da semana
  ↓
Substitui variáveis na mensagem ({name}, {phone}, etc)
  ↓
Envia mensagem
  ↓
Aplica delay anti-ban (3-8s)
  ↓
Próximo item
```

---

## ⚠️ Rate Limiting

O sistema implementa rate limiting para evitar ban do WhatsApp:

```javascript
// De config.js
whatsapp: {
  maxMessagesPerMinute: 20,
  maxMessagesPerHour: 200,
  maxMessagesPerDay: 1000,
  minDelayBetweenMessages: 3000,  // 3s
  maxDelayBetweenMessages: 8000,  // 8s
}
```

---

## 🐛 Troubleshooting

### Erro: "Webhook request failed"
- Verifique se WEBHOOK_URL está correto
- Verifique se WEBHOOK_SECRET bate em ambos os lados
- Confira logs para status code

### Erro: "Session not found"
- Verifique se session foi criada
- Verifique se está conectada (status = 'connected')
- Recrie a sessão se necessário

### QR Code não aparece
- Aguarde 2 segundos após o POST do /api/connect
- Verifique logs para mensagens de erro

### Fila não processa
- Verifique se horários ativos estão corretos
- Verifique se sessão está conectada
- Confira limite diário de mensagens

---

## 📝 Logs Importantes

Procure por estes logs para diagnóstico:

```
[session-manager] QR code received              → QR gerado
[session-manager] Connection opened             → Sessão autenticada
[session-manager] Connection closed             → Sessão desconectada
[queue-processor] Processing queue items       → Fila em processamento
[api] POST /api/connect                        → Requisição de conexão
[api] POST /api/send                           → Envio de mensagem
```

---

## 📚 Referências

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript)
- [Express.js Guide](https://expressjs.com/)
- [Pino Logger Documentation](https://getpino.io/)

---

## 📄 Licença

MIT

---

**Atualizado**: Março 13, 2026
**Versão**: 1.0.0
**Status**: ✅ Production Ready
