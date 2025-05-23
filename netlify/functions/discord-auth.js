// netlify/functions/discord-auth.js
const fetch = require('node-fetch');

// Discord Configuration
const DISCORD_CONFIG = {
    clientId: process.env.DISCORD_CLIENT_ID || '1374533327746236537',
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    apiEndpoint: 'https://discord.com/api/v10'
};

exports.handler = async (event, context) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Debug logging
    console.log('🚀 Function called:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        hasBody: !!event.body
    });

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        console.log('❌ Invalid method:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Method not allowed',
                allowed: ['POST'],
                received: event.httpMethod
            })
        };
    }

    try {
        // Parse request body
        let requestData = {};
        if (event.body) {
            try {
                requestData = JSON.parse(event.body);
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON in request body',
                        details: parseError.message 
                    })
                };
            }
        }

        const { code } = requestData;
        console.log('📥 Received code:', code ? `${code.substring(0, 10)}...` : 'null');

        // Validate required parameters
        if (!code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Authorization code is required' })
            };
        }

        // Check environment variables
        console.log('🔧 Config check:', {
            clientId: DISCORD_CONFIG.clientId ? 'Set' : 'Missing',
            clientSecret: DISCORD_CONFIG.clientSecret ? 'Set' : 'Missing',
            redirectUri: DISCORD_CONFIG.redirectUri ? 'Set' : 'Missing'
        });

        if (!DISCORD_CONFIG.clientSecret) {
            console.error('❌ DISCORD_CLIENT_SECRET not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'DISCORD_CLIENT_SECRET environment variable not set'
                })
            };
        }

        if (!DISCORD_CONFIG.redirectUri) {
            console.error('❌ DISCORD_REDIRECT_URI not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'DISCORD_REDIRECT_URI environment variable not set'
                })
            };
        }

        console.log('🔄 Exchanging code for token...');

        // Exchange code for access token
        const tokenParams = new URLSearchParams({
            client_id: DISCORD_CONFIG.clientId,
            client_secret: DISCORD_CONFIG.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_CONFIG.redirectUri,
        });

        console.log('📡 Token request params:', {
            client_id: DISCORD_CONFIG.clientId,
            grant_type: 'authorization_code',
            redirect_uri: DISCORD_CONFIG.redirectUri,
            code: `${code.substring(0, 10)}...`
        });

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenParams
        });

        console.log('📥 Token response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('❌ Token exchange failed:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorData
            });
            
            let errorMessage = 'Failed to obtain access token';
            if (tokenResponse.status === 400) {
                errorMessage = 'Invalid authorization code or configuration';
            }
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: errorMessage,
                    details: `Discord API returned ${tokenResponse.status}: ${errorData}`
                })
            };
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token obtained successfully');

        // Fetch user data
        console.log('👤 Fetching user data...');
        const userResponse = await fetch(`${DISCORD_CONFIG.apiEndpoint}/users/@me`, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
            },
        });

        console.log('📥 User response status:', userResponse.status);

        if (!userResponse.ok) {
            const errorData = await userResponse.text();
            console.error('❌ User fetch failed:', {
                status: userResponse.status,
                error: errorData
            });
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to fetch user data',
                    details: `Discord API returned ${userResponse.status}: ${errorData}`
                })
            };
        }

        const userData = await userResponse.json();
        console.log(`✅ User authenticated: ${userData.username}#${userData.discriminator || '0000'}`);

        // Format user data
        const formattedUser = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator || '0',
            globalName: userData.global_name,
            avatar: userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${(parseInt(userData.id.slice(-2)) % 6)}.png`,
            email: userData.email,
            verified: userData.verified,
            flags: userData.flags,
            premiumType: userData.premium_type
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: formattedUser,
                // Don't return the actual token for security
                hasToken: !!tokenData.access_token
            })
        };

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};