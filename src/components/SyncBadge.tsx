import { useI18n } from '../i18n/translate'
import { useAppStore } from '../store/app-store'
import type { SyncStatus } from '../types/models'

const DOT: Record<SyncStatus, string> = {
  synced: 'bg-success',
  syncing: 'bg-warn',
  offline: 'bg-muted',
  error: 'bg-danger',
}

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const { syncStatus, syncError, retrySync } = useAppStore()
  const label: Record<SyncStatus, string> = {
    synced: t('sync.synced'),
    syncing: t('sync.syncing'),
    offline: t('sync.offline'),
    error: t('sync.error'),
  }
  return (
    <button
      type="button"
      onClick={retrySync}
      title={
        syncStatus === 'error'
          ? syncError
            ? t('sync.errorDetail', { error: syncError })
            : t('sync.errorPlain')
          : syncStatus === 'offline'
            ? t('sync.offlineHint')
            : syncStatus === 'syncing'
              ? t('sync.syncingHint')
              : t('sync.okHint')
      }
      aria-label={label[syncStatus]}
      className={
        compact
          ? 'inline-flex size-10 items-center justify-center rounded-full bg-surface'
          : 'inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted'
      }
    >
      <span className={`rounded-full ${DOT[syncStatus]} ${compact ? 'size-2.5' : 'size-2'}`} />
      {compact ? null : label[syncStatus]}
    </button>
  )
}
