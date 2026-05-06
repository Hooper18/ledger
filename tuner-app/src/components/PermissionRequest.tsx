import { useTranslation } from 'react-i18next';
import type { PermissionStatus } from '../types/tuner';

interface Props {
  permission: PermissionStatus;
  onGrant: () => void;
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      {muted && (
        <line
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      )}
    </svg>
  );
}

export function PermissionRequest({ permission, onGrant }: Props) {
  const { t } = useTranslation();

  const isUnsupported = permission === 'unsupported';
  const isDenied = permission === 'denied';
  const isPending = permission === 'pending';
  const isOff = isDenied || isUnsupported;

  const title = isDenied ? t('permission.deniedTitle') : t('permission.title');
  const body = isUnsupported
    ? t('permission.unsupported')
    : isDenied
    ? t('permission.deniedHelp')
    : t('permission.description');

  const buttonLabel = isDenied ? t('permission.retry') : t('permission.grantButton');

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 py-10 text-center">
      <div className="w-full max-w-[320px]">
        <div
          className={`mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-elev ${
            isOff ? 'text-fg-dim' : 'text-fg-mute'
          }`}
        >
          <MicIcon muted={isOff} />
        </div>

        <h1 className="text-[20px] font-medium leading-tight text-fg">{title}</h1>

        <p className="mt-3 text-[14px] leading-relaxed text-fg-mute">{body}</p>

        {!isUnsupported && (
          <button
            onClick={onGrant}
            disabled={isPending}
            className="mt-8 inline-flex h-11 min-w-[180px] items-center justify-center rounded-full bg-fg px-6 text-[14px] font-medium text-deep transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
          >
            {isPending ? '…' : buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
