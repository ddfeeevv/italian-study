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
  const { syncStatus, retrySync } = useAppStore()
  return (
    <button
      type="button"
      onClick={retrySync}
      title={
        syncStatus === 'error'
          ? 'Синхронизация с облаком не удалась. Нажмите, чтобы повторить. Данные на этом устройстве сохранены.'
          : syncStatus === 'offline'
            ? 'Нет сети — правки копятся локально'
            : 'Статус синхронизации с Supabase'
      }
      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted"
    >
      <span className={`size-2 rounded-full ${DOT[syncStatus]}`} />
      {LABEL[syncStatus]}
    </button>
  )
}
