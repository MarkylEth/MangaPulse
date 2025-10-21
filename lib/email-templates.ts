// lib/email-templates.ts

/**
 * Генерация HTML для письма подтверждения регистрации
 */
export function getVerificationEmailHtml(verifyLink: string, mode: 'signup' | 'signin' = 'signup') {
  const title = mode === 'signup' ? 'Подтверждение регистрации' : 'Подтверждение входа';
  const greeting = mode === 'signup' ? 'Добро пожаловать на MangaPulse!' : 'Здравствуйте!';
  const instruction =
    mode === 'signup'
      ? 'Спасибо за регистрацию! Нажмите кнопку ниже, чтобы подтвердить ваш email и завершить регистрацию:'
      : 'Нажмите кнопку ниже, чтобы подтвердить вход в ваш аккаунт:';

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 30px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">MangaPulse</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 30px;">
              <h2 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;">${greeting}</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4b5563;">
                ${instruction}
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:10px 0 24px;">
                    <a href="${verifyLink}" 
                       style="display:inline-block;padding:14px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
                      Подтвердить email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6b7280;">
                Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:
              </p>
              <p style="margin:0;padding:12px;background-color:#f9fafb;border-radius:6px;font-size:13px;word-break:break-all;color:#3b82f6;">
                ${verifyLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#9ca3af;">
                <strong>Важно:</strong> Ссылка действительна в течение 24 часов.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;">
                Если вы не регистрировались на MangaPulse, просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer outside box -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr>
            <td align="center" style="padding:0 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} MangaPulse. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Простой текстовый вариант письма (fallback)
 */
export function getVerificationEmailText(verifyLink: string, mode: 'signup' | 'signin' = 'signup') {
  const greeting = mode === 'signup' ? 'Добро пожаловать на MangaPulse!' : 'Здравствуйте!';
  const instruction =
    mode === 'signup'
      ? 'Спасибо за регистрацию! Перейдите по ссылке ниже, чтобы подтвердить ваш email:'
      : 'Перейдите по ссылке ниже, чтобы подтвердить вход:';

  return `
${greeting}

${instruction}

${verifyLink}

Ссылка действительна в течение 24 часов.

Если вы не регистрировались на MangaPulse, просто проигнорируйте это письмо.

---
© ${new Date().getFullYear()} MangaPulse
  `.trim();
}
export function getPasswordResetEmailHtml(resetLink: string) {
  const brand = process.env.BRAND_NAME ?? 'MangaPulse';
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="ru">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Сброс пароля — ${brand}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Запрос на сброс пароля в ${brand}
  </div>
  <table role="presentation" width="100%" style="padding:40px 16px;background:#f5f7fb;">
    <tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(18,20,23,.06);overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eef2f7;font-family:system-ui,Segoe UI,Roboto,Arial">
          <strong style="font-size:16px">MangaPulse</strong>
        </td></tr>
        <tr><td style="padding:28px;font-family:system-ui,Segoe UI,Roboto,Arial;color:#111827;line-height:1.6;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;">Сброс пароля</h1>
          <p style="margin:0 0 18px;color:#334155;">Вы (или кто-то другой) запросили сброс пароля. Нажмите кнопку ниже, чтобы установить новый пароль.</p>
          <div style="margin:22px 0 8px;text-align:center;">
            <a href="${resetLink}" target="_blank" rel="noopener"
               style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              Установить новый пароль
            </a>
          </div>
          <p style="margin:14px 0 4px;color:#64748b;font-size:13px;">Если кнопка не работает, откройте ссылку:</p>
          <a href="${resetLink}" style="display:block;background:#f8fafc;border-radius:6px;padding:10px;color:#2563eb;word-break:break-all;font-size:13px">${resetLink}</a>
          <p style="margin:14px 0 0;color:#64748b;font-size:13px;">Ссылка действительна 60 минут. Если вы не запрашивали сброс — просто игнорируйте письмо.</p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #eef2f7;background:#fafbff;color:#94a3b8;font-size:12px;font-family:system-ui,Segoe UI,Roboto,Arial;">
          © ${year} ${brand}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export function getPasswordResetEmailText(resetLink: string) {
  const brand = process.env.BRAND_NAME ?? 'MangaPulse';
  return [
    `Сброс пароля — ${brand}`,
    '',
    'Вы запросили сброс пароля. Перейдите по ссылке, чтобы установить новый пароль:',
    resetLink,
    '',
    'Ссылка действует 60 минут. Если вы не запрашивали сброс — проигнорируйте письмо.'
  ].join('\n');
}