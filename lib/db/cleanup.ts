// lib/db/cleanup.ts
//import { db } from '@/lib/db';

//export async function cleanupExpiredTokens() {
//   await db.query(`
//     DELETE FROM auth_email_tokens 
//     WHERE expires_at < NOW() - INTERVAL '7 days'
//   `);
  
//   await db.query(`
//     DELETE FROM password_resets 
//     WHERE expires_at < NOW() - INTERVAL '7 days'
//   `);
// }

// app/api/cron/cleanup/route.ts
//import { cleanupExpiredTokens } from '@/lib/db/cleanup';

// export async function GET(request: Request) {
//   // Проверка секретного ключа (для Vercel Cron)
//   const authHeader = request.headers.get('authorization');
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//     return Response.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   await cleanupExpiredTokens();
//   return Response.json({ success: true });
// }

/**
 * your-project/
├── CRON-SETUP-INSTRUCTIONS.ts  ← Инструкция
├── lib/
│   └── db/
│       └── cleanup.ts
└── app/
    └── api/
        └── cron/
            └── cleanup/
                └── route.ts
```

### Вариант 2: Создать как README
Переименуйте в `CRON-SETUP.md` и храните в папке `docs/`:
```
your-project/
└── docs/
    └── CRON-SETUP.md  ← Инструкция в Markdown


 * ⏰ НАСТРОЙКА АВТОМАТИЧЕСКОЙ ОЧИСТКИ ТОКЕНОВ
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 ЧТО ДЕЛАЕТ ЭТОТ ENDPOINT:
 * 
 * API роут `/api/cron/cleanup` автоматически удаляет истёкшие токены из БД:
 * - auth_email_tokens (токены подтверждения email)
 * - password_resets (токены сброса пароля)
 * - revoked_tokens (отозванные JWT токены)
 * 
 * Токены старше 7 дней удаляются для оптимизации БД.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔧 КАК НАСТРОИТЬ АВТОМАТИЧЕСКИЙ ЗАПУСК:
 * 
 * Мы используем бесплатный сервис Cron-job.org для запуска очистки каждый день.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 📝 ПОШАГОВАЯ ИНСТРУКЦИЯ:
 * 
 * ШАГ 1: Сгенерировать секретный ключ
 * ----------------------------------------
 * Выполните в терминале:
 * 
 *   openssl rand -hex 32
 * 
 * Скопируйте результат (например: 5f8a9b3c2d1e4f7a6b8c9d0e1f2a3b4c...)
 * 
 * 
 * ШАГ 2: Добавить ключ в переменные окружения
 * ----------------------------------------
 * В файле .env (или в настройках хостинга) добавьте:
 * 
 *   CRON_SECRET=ваш-сгенерированный-ключ
 * 
 * Для Cloudflare Pages:
 *   Dashboard → Pages → Your Project → Settings → Environment variables
 *   
 * Для Vercel:
 *   Dashboard → Project → Settings → Environment Variables
 * 
 * 
 * ШАГ 3: Зарегистрироваться на Cron-job.org
 * ----------------------------------------
 * 🔗 Перейдите на: https://cron-job.org/en/signup
 * 
 * - Регистрация бесплатна
 * - Никаких кредитных карт не требуется
 * - Можно создать до 50 заданий на Free плане
 * 
 * 
 * ШАГ 4: Создать Cron Job
 * ----------------------------------------
 * После входа нажмите "Create cronjob"
 * 
 * Заполните форму:
 * 
 * 📌 Title:
 *    MangaPulse Token Cleanup
 * 
 * 📌 URL:
 *    https://ваш-домен.com/api/cron/cleanup
 *    (замените на ваш реальный домен)
 * 
 * 📌 Schedule:
 *    Every day at: 02:00 (выберите время)
 *    Или в формате cron: 0 2 * * *
 * 
 * 📌 Request method:
 *    GET
 * 
 * 📌 Custom HTTP headers (ВАЖНО!):
 *    Нажмите "Add HTTP header" и добавьте:
 *    
 *    Header name:  Authorization
 *    Header value: Bearer ваш-CRON_SECRET-ключ
 *    
 *    Например:
 *    Authorization: Bearer 5f8a9b3c2d1e4f7a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
 * 
 * 📌 Enable job:
 *    ✅ Отметьте галочку
 * 
 * Нажмите "Create cronjob"
 * 
 * 
 * ШАГ 5: Проверить работу
 * ----------------------------------------
 * В Cron-job.org можно вручную запустить задание кнопкой "Run now"
 * 
 * Или проверить вручную через curl:
 * 
 *   curl -X GET https://ваш-домен.com/api/cron/cleanup \
 *     -H "Authorization: Bearer ваш-CRON_SECRET"
 * 
 * Ожидаемый ответ:
 *   {"success":true,"timestamp":"2025-10-22T18:45:00.000Z"}
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔐 БЕЗОПАСНОСТЬ:
 * 
 * ✅ Endpoint защищён через Authorization header
 * ✅ Без правильного CRON_SECRET доступ запрещён (401 Unauthorized)
 * ✅ Секретный ключ должен быть длинным и случайным (минимум 32 символа)
 * ✅ НИКОГДА не коммитьте CRON_SECRET в git
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 📚 ПОЛЕЗНЫЕ ССЫЛКИ:
 * 
 * 🔗 Регистрация:     https://cron-job.org/en/signup
 * 🔗 Документация:    https://cron-job.org/en/documentation
 * 🔗 Cron формат:     https://crontab.guru
 * 🔗 Cloudflare Docs: https://developers.cloudflare.com/pages/configuration/headers
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ❓ ЧАСТЫЕ ВОПРОСЫ:
 * 
 * Q: Как часто запускать очистку?
 * A: Рекомендуем каждый день в 02:00 (когда меньше нагрузка)
 * 
 * Q: Что если забыл настроить cron?
 * A: Ничего страшного - токены просто будут накапливаться в БД.
 *    Очистка не критична для работы приложения.
 * 
 * Q: Можно ли использовать другой сервис?
 * A: Да! Любой сервис, который может делать GET запросы по расписанию:
 *    - UptimeRobot (https://uptimerobot.com)
 *    - EasyCron (https://www.easycron.com)
 *    - Cloudflare Workers (https://workers.cloudflare.com)
 * 
 * Q: Что делать, если получаю 401 Unauthorized?
 * A: Проверьте, что:
 *    1. CRON_SECRET добавлен в переменные окружения
 *    2. Header правильно отформатирован: "Bearer ключ" (с пробелом!)
 *    3. Нет лишних символов в ключе (пробелов, переносов строк)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 AFTER SETUP CHECKLIST:
 * 
 * ✅ Сгенерирован CRON_SECRET
 * ✅ CRON_SECRET добавлен в переменные окружения
 * ✅ Создан аккаунт на Cron-job.org
 * ✅ Создано задание на Cron-job.org
 * ✅ Добавлен Authorization header
 * ✅ Проверен ручной запуск (кнопка "Run now")
 * ✅ Получен ответ {"success":true}
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 💡 TIPS:
 * 
 * - В Cron-job.org можно настроить email-уведомления при ошибках
 * - История выполнений сохраняется (можно посмотреть логи)
 * - Можно временно отключить задание без удаления
 * - Поддерживается мониторинг времени отклика
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 📧 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ:
 * 
 * 1. Проверьте логи в Cron-job.org (вкладка "History")
 * 2. Проверьте логи вашего приложения
 * 3. Попробуйте запустить curl команду вручную
 * 4. Убедитесь, что endpoint доступен публично
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✨ После настройки этот файл можно удалить!
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Этот файл является только инструкцией и не содержит исполняемого кода.
// Реальная логика находится в:
// - lib/db/cleanup.ts (функция очистки)
// - app/api/cron/cleanup/route.ts (API endpoint)

export {};