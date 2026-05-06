import { useUpdateCheck } from '../hooks/useUpdateCheck';

export function UpdateBanner() {
  const { update, dismiss } = useUpdateCheck();
  if (!update) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 px-3 py-2 flex items-center gap-2 text-xs"
      style={{
        background: 'rgba(20, 20, 30, 0.92)',
        color: '#e2e8f0',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span className="flex-1 truncate">
        新版本 v{update.versionName} 可用
      </span>
      <a
        href={update.downloadUrl}
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-white"
        style={{ color: '#5eead4' }}
      >
        下载
      </a>
      <button
        onClick={dismiss}
        className="px-1 hover:text-white"
        style={{ color: '#94a3b8' }}
        aria-label="忽略"
      >
        ×
      </button>
    </div>
  );
}
