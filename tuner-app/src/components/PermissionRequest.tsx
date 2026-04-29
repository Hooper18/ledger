import { useTranslation } from 'react-i18next';
import type { PermissionStatus } from '../types/tuner';

interface Props {
  permission: PermissionStatus;
  onGrant: () => void;
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" stroke="var(--color-accent-warn)" strokeWidth="2" />}
    </svg>
  );
}

export function PermissionRequest({ permission, onGrant }: Props) {
  const { t } = useTranslation();

  const isUnsupported = permission === 'unsupported';
  const isDenied = permission === 'denied';
  const isPending = permission === 'pending';

  const title = isDenied ? t('permission.deniedTitle') : t('permission.title');
  const body = isUnsupported
    ? t('permission.unsupported')
    : isDenied
    ? t('permission.deniedHelp')
    : t('permission.description');

  const buttonLabel = isDenied ? t('permission.retry') : t('permission.grantButton');

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 py-10 text-center">
      <div
        className={`mb-8 flex h-24 w-24 items-center justify-center rounded-full ${
          isDenied || isUnsupported
            ? 'bg-elev text-fg-dim'
            : 'bg-elev text-accent'
        }`}
      >
        <MicIcon muted={isDenied || isUnsupported} />
      </div>

      <h1 className="text-2xl font-medium text-fg">{title}</h1>

      <p className="mt-3 max-w-xs text-sm leading-relaxed text-fg-mute">{body}</p>

      {!isUnsupported && (
        <button
          onClick={onGrant}
          disabled={isPending}
          className="mt-10 min-w-[180px] rounded-full bg-accent px-8 py-3.5 text-base font-medium text-deep transition-transform active:scale-95 disabled:opacity-50"
        >
          {isPending ? '…' : buttonLabel}
        </button>
      )}
    </div>
  );
}
