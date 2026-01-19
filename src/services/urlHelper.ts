import { Capacitor } from '@capacitor/core';

// URL生成ヘルパー関数: ネイティブアプリでは直接接続、Webではプロキシー経由
export function getApiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `https://transit.yahoo.co.jp${path}`;
  }
  return `/api/yahoo${path}`;
}

export function resolveCapacitorInterceptorUrl(url: string): string {
  if (url.includes('_capacitor_http_interceptor_')) {
    const tempUrl = new URL(url);
    const originalUrl = tempUrl.searchParams.get('u');
    if (originalUrl) {
      return originalUrl;
    }
  }
  return url;
}

export function normalizeYahooUrl(rawUrl: string): string {
  let url = resolveCapacitorInterceptorUrl(rawUrl);

  // Web環境（プロキシー経由）の場合、元のYahoo URLに復元する
  if (!Capacitor.isNativePlatform()) {
    try {
      const urlObj = new URL(url, window.location.href);
      if (urlObj.pathname.startsWith('/api/yahoo')) {
        const yahooPath = urlObj.pathname.replace(/^\/api\/yahoo/, '');
        url = `https://transit.yahoo.co.jp${yahooPath}${urlObj.search}`;
      }
    } catch (e) {
      console.warn("Failed to normalize URL", e);
    }
  }
  return url;
}

// 曜日からYahoo!のkind値を返すヘルパー
export function getCurrentDayKind(): number {
  const now = new Date();
  const day = now.getDay(); // 0: 日, 1: 月... 6: 土
  if (day === 0) return 4; // 日・祝
  if (day === 6) return 2; // 土曜
  return 1; // 平日
}
