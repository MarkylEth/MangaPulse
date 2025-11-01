import path from 'path';
import puppeteer from 'puppeteer';

// ВАЖНО: тот же URL, что и в основном боте
const SITE_URL = 'http://localhost:3000/title/80-ranka-chan-wa-bitch-ni-naritai'; // <-- замени на реальный URL страницы манги

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
    userDataDir: path.resolve('./.bot-profile'), // тот же профиль!
  });

  const page = await browser.newPage();
  await page.goto(SITE_URL, { waitUntil: 'networkidle2' });

  console.log('Окей. Сейчас сделай ТАК:');
  console.log('  1. В открывшемся окне войди в свой аккаунт (админ/переводчик).');
  console.log('  2. Вернись на страницу манги и убедись, что там есть кнопка "Добавить главу".');
  console.log('  3. НЕ закрывая браузер вручную, просто вернись в терминал и нажми Ctrl+C.');
  console.log('После этого профиль будет сохранён, и основной бот сможет работать авторизованным.');

  // держим процесс живым бесконечно, чтобы окно не закрылось
  await new Promise(() => {});
})();
