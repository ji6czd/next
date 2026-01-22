import { Capacitor } from '@capacitor/core';

export const vibrate = (duration: number | number[]): void => {
  if (Capacitor.isNativePlatform() && window.navigator.vibrate) {
    window.navigator.vibrate(duration);
  }
};
