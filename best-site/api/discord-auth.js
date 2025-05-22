// /api/discord-auth.js - Vercel Serverless Function

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const DISCORD_CONFIG = {
    clientId: '1374533327746236537',
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: 'https://<SEU-VERCEL-PROJETO>.vercel.app/auth/callback',
    apiEndpoint: 'https://discord.com/api/v10'
  };

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código de autorização não fornecido' });
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        client_secret: DISCORD_CONFIG.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_CONFIG.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      return res.status(400).json({ error: 'Falha ao obter token', details: err });
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_CONFIG.apiEndpoint}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userResponse.ok) {
      const err = await userResponse.text();
      return res.status(400).json({ error: 'Falha ao buscar usuário', details: err });
    }

    const userData = await userResponse.json();

    const formattedUser = {
      id: userData.id,
      username: userData.username,
      globalName: userData.global_name || userData.username,
      discriminator: userData.discriminator || '0',
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(userData.id) >> 22) % 6}.png`,
      email: userData.email
    };

    res.status(200).json({
      success: true,
      user: formattedUser
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro interno', details: error.message });
  }
};
