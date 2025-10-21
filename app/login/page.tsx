// app/login/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthModal from '@/components/auth/AuthModal';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Обработка параметров из URL после verify
    const verified = searchParams.get('verified');
    const alreadyUsed = searchParams.get('already_used');
    const error = searchParams.get('error');

    if (verified === '1') {
      if (alreadyUsed === '1') {
        setMessage({
          type: 'success',
          text: 'Ваш email уже был подтвержден ранее. Теперь вы можете войти.',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Email успешно подтвержден! Теперь вы можете войти с паролем.',
        });
      }
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_token: 'Отсутствует токен подтверждения',
        invalid_token: 'Неверный или недействительный токен',
        token_expired: 'Срок действия токена истек. Попробуйте зарегистрироваться снова.',
        internal: 'Произошла внутренняя ошибка. Попробуйте позже.',
      };
      setMessage({
        type: 'error',
        text: errorMessages[error] || 'Произошла ошибка',
      });
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-md p-6">
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <AuthModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          initialMode="login"
        />
      </div>
    </div>
  );
}