// lib/mail.ts
import { sendEmailResend } from '@/lib/resend';
import { getVerificationEmailHtml, getVerificationEmailText } from '@/lib/email-templates';

type Ok = { ok: true; provider: 'resend' };
type Fail = { ok: false; provider: 'resend'; error: string };

/**
 * Проверка готовности SMTP (для совместимости с существующим кодом)
 * Resend не требует проверки транспорта
 */
export async function verifySmtp(): Promise<Ok> {
  return { ok: true, provider: 'resend' };
}

/**
 * Отправка письма с подтверждением email
 */
export async function sendVerificationEmail(
  to: string,
  link: string,
  mode: 'signup' | 'signin' = 'signup'
): Promise<Ok | Fail> {
  try {
    const subject = mode === 'signup' 
      ? 'Подтверждение регистрации на MangaPulse' 
      : 'Подтверждение входа на MangaPulse';

    await sendEmailResend({
      to,
      subject,
      html: getVerificationEmailHtml(link, mode),
      text: getVerificationEmailText(link, mode), // Опциональный text fallback
    });

    return { ok: true, provider: 'resend' };
  } catch (e: any) {
    console.error('[sendVerificationEmail] Error:', e);
    return { 
      ok: false, 
      provider: 'resend', 
      error: e?.message || 'send_failed' 
    };
  }
}

/**
 * Отправка письма сброса пароля (для будущей реализации)
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<Ok | Fail> {
  try {
    await sendEmailResend({
      to,
      subject: 'Сброс пароля на MangaPulse',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2>Сброс пароля</h2>
          <p>Вы запросили сброс пароля. Нажмите кнопку ниже:</p>
          <p>
            <a href="${resetLink}" 
               style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;">
              Сбросить пароль
            </a>
          </p>
          <p style="color:#666;font-size:14px;">Ссылка действительна 1 час.</p>
          <p style="color:#666;font-size:14px;">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        </div>
      `,
    });

    return { ok: true, provider: 'resend' };
  } catch (e: any) {
    return { 
      ok: false, 
      provider: 'resend', 
      error: e?.message || 'send_failed' 
    };
  }
}