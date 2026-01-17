import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seikenlab.next',
  appName: 'NEX-T',
  webDir: 'dist',
  // PC版のChromeとして振る舞うようにUser-Agentを偽装
  overrideUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
