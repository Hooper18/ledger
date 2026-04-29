import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, children }: Props) {
  // Lock background touchmove while open so the sheet doesn't drag the page.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.touchAction;
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.touchAction = prev;
    };
  }, [open]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-elev shadow-[0_-12px_40px_rgba(0,0,0,0.4)] transition-transform duration-250 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        {children}
      </div>
    </>
  );
}
