import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { shareDeck } from '../lib/classroom'
import { useI18n } from '../i18n/translate'
import { useSocial } from '../store/social-store'
import { CopyPair } from './CopyPair'
import { Button, Sheet } from './ui'

export function ShareDeckButton({ deckId }: { deckId: string }) {
  const { t } = useI18n()
  const { profile } = useSocial()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (profile?.role !== 'teacher') return null

  const show = async () => {
    setOpen(true)
    if (code || busy) return
    setBusy(true)
    setError(null)
    const result = await shareDeck(deckId)
    setBusy(false)
    setCode(result.code)
    setError(result.error)
  }

  return (
    <>
      <Button className="w-full" variant="secondary" onClick={() => void show()}>
        <Share2 size={16} />
        {t('share.action')}
      </Button>
      {open ? (
        <Sheet onClose={() => setOpen(false)}>
          <h2 className="font-display text-2xl">{t('share.title')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t('share.lead')}</p>
          {busy ? <p className="mt-4 text-sm text-muted">{t('common.loading')}</p> : null}
          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {code ? (
            <div className="mt-4">
              <CopyPair code={code} path={`/share/${code}`} />
            </div>
          ) : null}
        </Sheet>
      ) : null}
    </>
  )
}
