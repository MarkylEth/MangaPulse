/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { turbo: {} },
  images: {
    remotePatterns: [
      // wasabi
      { protocol: 'https', hostname: '**.wasabisys.com' },
      { protocol: 'https', hostname: 's3.**.wasabisys.com' },

      // твои текущие
      { protocol: 'https', hostname: 'image.winudf.com' },
      { protocol: 'https', hostname: '**.winudf.com' },
      { protocol: 'https', hostname: 'xlm.ru' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },

      // shikimori
      { protocol: 'https', hostname: 'shikimori.one' },
      { protocol: 'https', hostname: 'shikimori.me' },
      { protocol: 'https', hostname: 'static.shikimori.one' },
      { protocol: 'https', hostname: 'desu.shikimori.one' },
    ],
  },
};
export default nextConfig;
