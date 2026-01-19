import { useRef, useEffect } from 'react';
import { LIBRARIES } from '../constants/libraries';
import './AboutModal.css';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // モーダルが開いたときに最初の要素にフォーカス
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div ref={modalRef} className="modal-content">
        <h2 className="modal-title">このアプリについて</h2>
        <p>Copyright © 2026 NEX-T App</p>

        <h3 className="modal-subtitle">オープンソースライセンス</h3>
        <ul className="library-list">
          {LIBRARIES.map((lib) => (
            <li key={lib.name} className="library-item">
              <div className="library-name">{lib.name}</div>
              <div className="library-license">License: {lib.license}</div>
              {lib.copyright && <div className="library-copyright">{lib.copyright}</div>}
            </li>
          ))}
        </ul>

        <div className="modal-footer">
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
