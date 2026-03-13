# ✅ API-Render - Checklist de Verificação

Data: Março 13, 2026
Versão: 1.0.0

---

## 🔍 Verificação de Configuração

### Variáveis de Ambiente

- [ ] `PORT` configurado (padrão: 3001)
- [ ] `SERVER_SECRET` = "gestor-disparo-secret"
- [ ] `NODE_ENV` = "production"
- [ ] `LOG_LEVEL` definido (recomendado: "info")
- [ ] `SUPABASE_URL` válida
- [ ] `SUPABASE_SERVICE_ROLE_KEY` válida e com permissões corretas
- [ ] `WEBHOOK_URL` = "https://seu-frontend.vercel.app/api/webhook/baileys"
- [ ] `WEBHOOK_SECRET` = "gestor-disparo-secret"

**Status**: [ ] ✅ Todas as variáveis configuradas

---

## 🏗️ Verificação Estrutural

### Arquivos Necessários

- [ ] `src/index.js` - Entry point
- [ ] `src/config.js` - Configuração
- [ ] `src/api.js` - Rotas Express
- [ ] `src/logger.js` - Sistema de logging
- [ ] `src/session-manager.js` - Gerenciamento de sessões
- [ ] `src/queue-processor.js` - Processador de fila
- [ ] `src/webhook.js` - Cliente de webhook
- [ ] `src/supabase.js` - Cliente Supabase
- [ ] `package.json` - Dependências
- [ ] `.env` - Variáveis de ambient

**Status**: [ ] ✅ Todos os arquivos presentes

### Dependências

- [ ] `@whiskeysockets/baileys` instalado
- [ ] `@supabase/supabase-js` instalado
- [ ] `express` instalado
- [ ] `cors` instalado
- [ ] `pino` instalado
- [ ] `qrcode` instalado
- [ ] `dotenv` instalado
- [ ] `p-queue` instalado

**Status**: [ ] ✅ Todas as dependências instaladas

---

## 🔒 Verificação de Segurança

### Autenticação

- [ ] Middleware de autenticação implementado
- [ ] Valida header `Authorization: Bearer {token}`
- [ ] Extrai token corretamente com `split(' ')[1]`
- [ ] Compara com `config.serverSecret`
- [ ] Endpoint `/health` é público (sem autenticação)
- [ ] Todos outros endpoints POST requerem autenticação

**Status**: [ ] ✅ Autenticação corrigida

### Headers

- [ ] CORS habilitado em `app.use(cors())`
- [ ] Content-Type JSON definido em middleware
- [ ] Webhook envia `Authorization: Bearer` (não `x-webhook-secret`)

**Status**: [ ] ✅ Headers corretos

---

## 🔌 Verificação de Endpoints

### POST /api/connect

- [ ] Recebe `session_id`, `user_id`, `phone_number`
- [ ] Valida parâmetros obrigatórios
- [ ] Chama `initSession()`
- [ ] Aguarda 2s para QR code
- [ ] Retorna QR code base64 ou null
- [ ] Status 400 se faltarem parâmetros
- [ ] Status 500 se houver erro

**Status**: [ ] ✅ Endpoint correto

### POST /api/disconnect

- [ ] Recebe `session_id`
- [ ] Valida parâmetro
- [ ] Chama `disconnectSession()`
- [ ] Limpa arquivos de sessão
- [ ] Atualiza database
- [ ] Retorna confirmaçãode sucesso

**Status**: [ ] ✅ Endpoint correto

### POST /api/send

- [ ] Recebe `session_id`, `to`, `message`
- [ ] Opciona: `media_url`, `message_db_id`
- [ ] Valida parâmetros obrigatórios
- [ ] Verifica se sessão existe
- [ ] Envia via Baileys
- [ ] Incrementa contador de mensagens
- [ ] Atualiza DB se `message_db_id` fornecido
- [ ] Retorna `wa_message_id` e timestamp

**Status**: [ ] ✅ Endpoint correto

### POST /api/send-bulk

- [ ] Recebe `session_ids`, `contact_ids`, `user_id`
- [ ] Valida parâmetros
- [ ] Chama `triggerProcessing(user_id)`
- [ ] Retorna contagem de sessões e contatos

**Status**: [ ] ✅ Endpoint correto

### GET /health

- [ ] Sem autenticação
- [ ] Retorna status "ok"
- [ ] Retorna timestamp
- [ ] Retorna contagem de sessões

**Status**: [ ] ✅ Endpoint correto

---

## 📊 Verificação de Banco de Dados

### Supabase Connection

- [ ] Cliente criado com `createClient()`
- [ ] Usando `SERVICE_ROLE_KEY` (não anonymous)
- [ ] `auth.autoRefreshToken = false`
- [ ] `auth.persistSession = false`

**Status**: [ ] ✅ Supabase configurado

### Database Helpers

- [ ] `getSession()` busca de whatsapp_sessions
- [ ] `updateSession()` atualiza sessão
- [ ] `getAllActiveSessions()` retorna conectadas
- [ ] `getPendingQueueItems()` retorna itens de fila
- [ ] `updateQueueItem()` atualiza itens
- [ ] `createDispatchLog()` cria logs
- [ ] `saveMessage()` salva mensagens
- [ ] `findOrCreateContact()` upsert de contatos
- [ ] `getDispatchConfig()` busca config padrão
- [ ] `incrementDailyMessageCount()` incrementa contador

**Status**: [ ] ✅ Todos os helpers disponíveis

---

## 🔄 Verificação de Fluxo

### Session Manager

- [ ] `initSession()` inicializa Baileys
- [ ] Gera QR code quando necessário
- [ ] Envia webhook ao conectar
- [ ] Envia webhook ao desconectar
- [ ] Envia webhook ao receber mensagem
- [ ] Suporta reconnect automático
- [ ] Limpa sessão ao logout
- [ ] `restoreSessions()` restaura ao iniciar

**Status**: [ ] ✅ Session manager funcionando

### Queue Processor

- [ ] Inicia ao startup do servidor
- [ ] Processa itens a cada 5 segundos
- [ ] Respeita horários ativos
- [ ] Respeita dias da semana ativos
- [ ] Respeita limite diário por sessão
- [ ] Substitui variáveis em mensagens
- [ ] Aplica delays entre mensagens
- [ ] Retry automático em caso de erro
- [ ] Máximo de 3 tentativas
- [ ] Cria logs de sucesso e falha

**Status**: [ ] ✅ Queue processor funcionando

### Webhook

- [ ] URL configurada
- [ ] Secret configurado
- [ ] Header correto: `Authorization: Bearer`
- [ ] Payload com estrutura correta
- [ ] Eventos: SESSION_CONNECTED, MESSAGE_RECEIVED, MESSAGE_SENT, etc.
- [ ] Tratamento de erro se webhook falhar

**Status**: [ ] ✅ Webhook funcionando

---

## 📝 Verificação de Logging

### Logger (Pino)

- [ ] Importado em todos os arquivos
- [ ] `createLogger(module)` cria logger com módulo
- [ ] Logs estruturados com contexto
- [ ] Nível de log respeitado
- [ ] Produção: JSON estruturado
- [ ] Desenvolvimento: Pretty-print

**Status**: [ ] ✅ Logging correto

### Mensagens de Log Importantes

- [ ] "Starting Baileys WhatsApp Server"
- [ ] "HTTP server started successfully"
- [ ] "Restoring active sessions"
- [ ] "QR code received"
- [ ] "Connection opened"
- [ ] "Connection closed"
- [ ] "Message received"
- [ ] "Message sent"
- [ ] "Processing queue items"

**Status**: [ ] ✅ Logs aparecem corretamente

---

## ⚠️ Verificação de Tratamento de Erro

### Errors Handling

- [ ] Try-catch em operações async
- [ ] Logging de erros com stack trace
- [ ] HTTP status codes apropriados
- [ ] Mensagens de erro amigáveis
- [ ] Não expõe detalhes internos em produção
- [ ] Error handler middleware implementado
- [ ] Graceful shutdown implementado

**Status**: [ ] ✅ Tratamento de erro correto

---

## 🚀 Verificação Pre-Deploy

### Code Quality

- [ ] Sem console.log() (usar logger)
- [ ] Sem hardcoded secrets
- [ ] Sem variáveis não utilizadas
- [ ] Imports correcetos
- [ ] Exports definidos
- [ ] Comments atualizados

**Status**: [ ] ✅ Qualidade de código OK

### Performance

- [ ] Sessions mantidas em memória
- [ ] QR codes em memória
- [ ] Fila processada em background
- [ ] Rate limiting implementado
- [ ] Delays anti-ban

**Status**: [ ] ✅ Performance OK

### Deployment Ready

- [ ] Dockerfile funcional (se usar)
- [ ] Node.js versão >= 20.x
- [ ] `.env.example` criado
- [ ] README atualizado
- [ ] Commit preparado
- [ ] Todos os testes passando

**Status**: [ ] ✅ Pronto para deployment

---

## 📋 Render.com Deployment Checklist

- [ ] Repositório Git conectado
- [ ] Variáveis de ambiente configuradas no Render
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Health check apontando para `/health`
- [ ] Port configurado em `PORT` env var
- [ ] Auto-deploy em main branch habilitado
- [ ] Logs visíveis no Render dashboard

**Status**: [ ] ✅ Render configurado

---

## 🧪 Testes Manuais

### Teste 1: Health Check
```bash
curl https://seu-api.onrender.com/health
# Esperado: { "status": "ok", "timestamp": "...", "sessions": 0 }
```
**Status**: [ ] ✅ Passou

### Teste 2: Conexão (sem auth)
```bash
curl -X POST https://seu-api.onrender.com/api/connect \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "user_id": "user1", "phone_number": "5511999999999"}'
# Esperado: 401 Unauthorized
```
**Status**: [ ] ✅ Passou

### Teste 3: Conexão (com auth)
```bash
curl -X POST https://seu-api.onrender.com/api/connect \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "user_id": "user1", "phone_number": "5511999999999"}'
# Esperado: 200 com QR code
```
**Status**: [ ] ✅ Passou

### Teste 4: Envio de Mensagem
```bash
curl -X POST https://seu-api.onrender.com/api/send \
  -H "Authorization: Bearer gestor-disparo-secret" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "uuid", "to": "5511999999999@s.whatsapp.net", "message": "Teste"}'
# Esperado: 200 com wa_message_id
```
**Status**: [ ] ✅ Passou

---

## ✨ Resultado Final

**Todos os testes passaram?** [ ] Sim [ ] Não

**Status Geral**: 
- [ ] ✅ **PRONTO PARA PRODUÇÃO**
- [ ] ⚠️ **COM RESSALVAS**
- [ ] ❌ **NÃO PRONTO**

---

**Data de Verificação**: _______________
**Verificado por**: _______________
**Observações**: _________________________________________________________________

---

**Próximos passos**:
1. [ ] Fazer commit das mudanças
2. [ ] Push para main branch
3. [ ] Render fará redeploy automático
4. [ ] Verificar logs no Render dashboard
5. [ ] Testar endpoints em produção
