// lib/resend.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️ RESEND_API_KEY not set. Email sending will fail.');
}

export const resend = new Resend(process.env.RESEND_API_KEY || '');

// Адрес отправителя
// Поддерживаем оба формата: RESEND_FROM и RESEND_FROM_EMAIL
export const FROM = 
  process.env.RESEND_FROM_EMAIL || 
  process.env.RESEND_FROM || 
  'onboarding@resend.dev';

// Базовый URL приложения
export const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  `http://localhost:${process.env.PORT ?? 3000}`;

/**
 * Отправка email через Resend (только HTML, без React Email)
 */
export async function sendEmailResend({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    // Важно: используем обычный метод send, а не render
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text && { text }),
    });

    if (error) {
      console.error('[Resend] API error:', error);
      throw new Error(error.message || 'Resend API error');
    }

    return { success: true, id: data?.id };
  } catch (error: any) {
    console.error('[Resend] Send error:', error);
    throw error;
  }
}