// server.js - Backend Node.js para Discord OAuth
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;


// Redirecionar para Discord OAuth
const loginWithDiscord = () => {
  const discordAuthUrl = 'https://discord.com/oauth2/authorize?client_id=1374533327746236537&response_type=code&redirect_uri=https%3A%2F%2Fdainty-tapioca-2d60a5.netlify.app%2Fauth%2Fcallback&scope=email+identify' + 
    'client_id=1374533327746236537&' +
    'redirect_uri=https%3A%2F%2Fdainty-tapioca-2d60a5.netlify.app%2Fauth%2Fcallback&' +
    'response_type=code&' +
    'scope=identify%20email';
  
  window.location.href = discordAuthUrl;
};

// Processar callback (na página /auth/callback)
const handleDiscordCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    try {
      const response = await fetch('/.netlify/functions/discord-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Usuário logado:', data.user);
        // Salvar dados do usuário e redirecionar
      } else {
        console.error('Erro na autenticação:', data.error);
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  }
};
// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Configurações Discord
const DISCORD_CONFIG = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    apiEndpoint: 'https://discord.com/api/v10'
};

// Verificar configurações
if (!DISCORD_CONFIG.clientId || !DISCORD_CONFIG.clientSecret) {
    console.error('❌ Configure as variáveis de ambiente DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET');
    process.exit(1);
}

// Rota para trocar código por token
app.post('/api/discord-auth', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Código não fornecido' });
        }

        console.log('🔄 Trocando código por token...');

        // Trocar código por token de acesso
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: DISCORD_CONFIG.clientId,
                client_secret: DISCORD_CONFIG.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: DISCORD_CONFIG.redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('❌ Erro ao obter token:', errorData);
            return res.status(400).json({ error: 'Falha ao obter token de acesso' });
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token obtido com sucesso');

        // Buscar dados do usuário
        const userResponse = await fetch(`${DISCORD_CONFIG.apiEndpoint}/users/@me`, {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        if (!userResponse.ok) {
            console.error('❌ Erro ao buscar dados do usuário');
            return res.status(400).json({ error: 'Falha ao buscar dados do usuário' });
        }

        const userData = await userResponse.json();
        console.log(`✅ Usuário logado: ${userData.username}`);

        // Formatar dados do usuário
        const formattedUser = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator) % 5}.png`,
            email: userData.email,
            verified: userData.verified
        };

        res.json({
            success: true,
            user: formattedUser,
            token: tokenData.access_token // Opcional: para refresh futuro
        });

    } catch (error) {
        console.error('❌ Erro no processo de autenticação:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
});

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor Discord Auth funcionando',
        timestamp: new Date().toISOString()
    });
});

// Rota para verificar configuração
app.get('/api/config', (req, res) => {
    res.json({
        clientId: DISCORD_CONFIG.clientId,
        redirectUri: DISCORD_CONFIG.redirectUri,
        configured: !!(DISCORD_CONFIG.clientId && DISCORD_CONFIG.clientSecret)
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`📋 Client ID: ${DISCORD_CONFIG.clientId ? 'Configurado ✅' : 'Não configurado ❌'}`);
    console.log(`🔐 Client Secret: ${DISCORD_CONFIG.clientSecret ? 'Configurado ✅' : 'Não configurado ❌'}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

app.post('/api/purchase-notification', async (req, res) => {
    try {
        const { user, playerId, total, items, transactionId, timestamp } = req.body;

        // Validar dados obrigatórios
        if (!user || !playerId || !total || !items) {
            return res.status(400).json({ 
                error: 'Dados incompletos',
                required: ['user', 'playerId', 'total', 'items']
            });
        }

        console.log('🛒 Processando notificação de compra...');

        // Formatar lista de itens
        let itemsList = '';
        if (Array.isArray(items)) {
            itemsList = items.map(item => {
                if (typeof item === 'object') {
                    return `• ${item.name} - Qtd: ${item.quantity} - R$ ${item.price}`;
                }
                return `• ${item}`;
            }).join('\n');
        } else {
            itemsList = items;
        }

        // Criar embed do Discord
        const embed = {
            title: '🛒 Nova Compra Realizada',
            description: 'Um novo pedido foi finalizado na loja BestRP',
            color: 0x00ff00, // Verde para sucesso
            fields: [
                {
                    name: '👤 Usuário',
                    value: `${user.username || user}`,
                    inline: true
                },
                {
                    name: '🆔 ID do Jogador',
                    value: `${playerId}`,
                    inline: true
                },
                {
                    name: '💰 Valor Total',
                    value: `R$ ${parseFloat(total).toFixed(2)}`,
                    inline: true
                },
                {
                    name: '📦 Itens Comprados',
                    value: itemsList || 'Nenhum item especificado',
                    inline: false
                }
            ],
            footer: {
                text: 'Sistema de Loja BestRP',
                icon_url: 'https://cdn.discordapp.com/attachments/123456789/logo.png'
            },
            timestamp: timestamp || new Date().toISOString()
        };

        // Adicionar ID da transação se fornecido
        if (transactionId) {
            embed.fields.push({
                name: '🔗 ID da Transação',
                value: `${transactionId}`,
                inline: true
            });
        }

        // Criar mensagem para o webhook
        const webhookMessage = {
            username: 'Loja BestRP',
            avatar_url: 'https://cdn.discordapp.com/attachments/123456789/avatar.png',
            embeds: [embed]
        };

        // Enviar para o webhook do Discord
        const discordResponse = await fetch(DISCORD_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookMessage)
        });

        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            console.error('❌ Erro ao enviar para webhook do Discord:', errorText);
            return res.status(500).json({ 
                error: 'Erro ao enviar notificação para o Discord',
                details: errorText
            });
        }

        console.log('✅ Notificação enviada para o Discord com sucesso');

        res.json({
            success: true,
            message: 'Notificação de compra enviada com sucesso',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro ao processar notificação de compra:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Rota para testar o webhook
app.post('/api/test-webhook', async (req, res) => {
    try {
        const testMessage = {
            username: 'Loja BestRP - Teste',
            embeds: [{
                title: '🧪 Teste de Webhook',
                description: 'Esta é uma mensagem de teste para verificar se o webhook está funcionando corretamente.',
                color: 0x0099ff,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Sistema de Testes'
                }
            }]
        };

        const response = await fetch(DISCORD_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testMessage)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(500).json({ 
                error: 'Webhook não está funcionando',
                details: errorText
            });
        }

        res.json({ 
            success: true, 
            message: 'Webhook testado com sucesso!' 
        });

    } catch (error) {
        console.error('❌ Erro ao testar webhook:', error);
        res.status(500).json({
            error: 'Erro ao testar webhook',
            details: error.message
        });
    }
});

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor Discord Auth funcionando',
        timestamp: new Date().toISOString(),
        webhook_configured: !!DISCORD_CONFIG.webhookUrl
    });
});

// Rota para verificar configuração
app.get('/api/config', (req, res) => {
    res.json({
        clientId: DISCORD_CONFIG.clientId,
        redirectUri: DISCORD_CONFIG.redirectUri,
        configured: !!(DISCORD_CONFIG.clientId && DISCORD_CONFIG.clientSecret),
        webhook_configured: !!DISCORD_CONFIG.webhookUrl
    });
});

// Exemplos de uso das notificações:
notifications.success('Título', 'Mensagem de sucesso');
notifications.error('Erro', 'Algo deu errado');
notifications.warning('Atenção', 'Aviso importante');
notifications.info('Info', 'Informação geral');
