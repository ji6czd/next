import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export function useBackButton(
  view: 'search' | 'lines' | 'timetable',
  showAbout: boolean,
  handlers: {
    closeAbout: () => void;
    toLines: () => void;
    toSearch: () => void;
  }
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backHandler = CapacitorApp.addListener('backButton', () => {
      if (showAbout) {
        handlers.closeAbout();
      } else if (view === 'timetable') {
        handlers.toLines();
      } else if (view === 'lines') {
        handlers.toSearch();
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backHandler.then(h => h.remove());
    };
  }, [view, showAbout, handlers]);
}
