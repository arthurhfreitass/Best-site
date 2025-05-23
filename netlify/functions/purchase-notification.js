const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { user, playerId, total, items, transactionId, timestamp } = JSON.parse(event.body);

    if (!user || !playerId || !total || !items) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Dados obrigatórios ausentes',
          required: ['user', 'playerId', 'total', 'items']
        })
      };
    }

    const embed = {
      title: '🛒 Nova Compra Realizada',
      description: 'Um novo pedido foi finalizado na loja BestRP',
      color: 0x00ff00,
      fields: [
        { name: '👤 Usuário', value: user, inline: true },
        { name: '🆔 ID do Jogador', value: playerId, inline: true },
        { name: '💰 Valor Total', value: `R$ ${parseFloat(total).toFixed(2)}`, inline: true },
        {
          name: '📦 Itens Comprados',
          value: Array.isArray(items)
            ? items.map(i => `• ${i.name} - Qtd: ${i.quantity} - R$ ${i.price}`).join('\n')
            : String(items),
          inline: false
        }
      ],
      timestamp: timestamp || new Date().toISOString(),
      footer: {
        text: 'Loja BestRP',
        icon_url: 'https://cdn.discordapp.com/attachments/123456789/logo.png'
      }
    };

    if (transactionId) {
      embed.fields.push({ name: '🔗 ID da Transação', value: transactionId, inline: true });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Webhook do Discord não configurado (env: DISCORD_WEBHOOK_URL)' })
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Loja BestRP',
        avatar_url: 'https://cdn.discordapp.com/attachments/123456789/avatar.png',
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erro ao enviar para o Discord', details: err })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Notificação enviada ao Discord com sucesso' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno no servidor', details: err.message })
    };
  }
};
