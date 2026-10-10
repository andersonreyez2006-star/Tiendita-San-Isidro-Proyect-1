function requiredGoogleConfig() {
  const config = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    senderEmail: process.env.GOOGLE_SENDER_EMAIL,
    appBaseUrl: process.env.APP_BASE_URL
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Falta configuración de correo de Google: ${missing.join(', ')}`);
  }

  let baseUrl;
  try {
    baseUrl = new URL(config.appBaseUrl);
  } catch {
    throw new Error('APP_BASE_URL debe ser una URL válida.');
  }
  if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL debe usar HTTPS en producción.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.senderEmail)) {
    throw new Error('GOOGLE_SENDER_EMAIL no tiene un formato válido.');
  }
  return { ...config, appBaseUrl: baseUrl.toString().replace(/\/$/, '') };
}

async function getGoogleAccessToken({ clientId, clientSecret, refreshToken }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!response.ok) {
    throw new Error(`Google OAuth rechazó la renovación del token (${response.status}).`);
  }
  const payload = await response.json();
  if (typeof payload.access_token !== 'string') {
    throw new Error('Google OAuth no devolvió un token de acceso válido.');
  }
  return payload.access_token;
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export async function sendAccountLink({ to, token, purpose }) {
  const config = requiredGoogleConfig();
  const isReset = purpose === 'password_reset';
  const queryName = isReset ? 'reset_token' : 'verify_token';
  const link = `${config.appBaseUrl}/?${queryName}=${encodeURIComponent(token)}`;
  const subject = isReset ? 'Restablece tu contraseña' : 'Verifica tu correo';
  const action = isReset ? 'Cambiar contraseña' : 'Verificar correo';
  const explanation = isReset
    ? 'Recibimos una solicitud para restablecer la contraseña de tu cuenta.'
    : 'Confirma que puedes recibir correos en esta dirección.';
  const html = `<p>${explanation}</p><p><a href="${link}">${action}</a></p><p>El enlace vence en una hora y solo puede utilizarse una vez. Si no solicitaste este mensaje, puedes ignorarlo.</p>`;
  const accessToken = await getGoogleAccessToken(config);
  const mimeMessage = [
    `From: Tiendita San Isidro <${config.senderEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64')
  ].join('\r\n');
  const raw = Buffer.from(mimeMessage, 'utf8').toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });
  if (!response.ok) {
    throw new Error(`Gmail API no pudo enviar el mensaje (${response.status}).`);
  }
}
