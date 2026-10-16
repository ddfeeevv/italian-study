import { useAppStore } from '../store/app-store'
import type { SyncStatus } from '../types/models'

const LABEL: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing',
  offline: 'Offline',
  error: 'Ошибка',
}

const DOT: Record<SyncStatus, string> = {
  synced: 'bg-success',
  syncing: 'bg-warn',
  offline: 'bg-muted',
  error: 'bg-danger',
}

export function SyncBadge() {
  const { syncStatus, syncError, retrySync } = useAppStore()
  return (
    <button
      type="button"
      onClick={retrySync}
      title={
        syncStatus === 'error'
          ? syncError
            ? `Синк не удался: ${syncError}. Нажмите, чтобы повторить. Локальные данные на месте.`
            : 'Синхронизация с облаком не удалась. Нажмите, чтобы повторить.'
          : syncStatus === 'offline'
            ? 'Нет сети — правки копятся локально'
            : syncStatus === 'syncing'
              ? 'Идёт отправка в Supabase…'
              : 'Статус синхронизации с Supabase'
      }
      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted"
    >
      <span className={`size-2 rounded-full ${DOT[syncStatus]}`} />
      {LABEL[syncStatus]}
    </button>
  )
}
