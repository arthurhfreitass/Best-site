const fetch = require('node-fetch');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { user, playerId, total, items, transactionId, timestamp } = body;

    if (!user || !playerId || !total || !items) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Dados incompletos',
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
        { name: '📦 Itens Comprados', value: Array.isArray(items)
          ? items.map(i => `• ${i.name} - Qtd: ${i.quantity} - R$ ${i.price}`).join('\n')
          : items, inline: false }
      ],
      timestamp: timestamp || new Date().toISOString(),
      footer: {
        text: 'Loja BestRP',
        icon_url: 'https://cdn.discordapp.com/attachments/123456789/logo.png'
      }
    };

    if (transactionId) {
      embed.fields.push({
        name: '🔗 ID da Transação',
        value: transactionId,
        inline: true
      });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'DISCORD_WEBHOOK_URL não configurado' })
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
      const error = await response.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Falha ao enviar webhook', details: error })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Notificação enviada' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro inesperado', details: err.message })
    };
  }
};
