import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AvatarBadge } from '../components/AvatarBadge'
import { Button, Card, Page } from '../components/ui'
import { previewShare, redeemShare, type SharePreview } from '../lib/classroom'
import { useI18n } from '../i18n/translate'
import { useAppStore } from '../store/app-store'
import { useSocial } from '../store/social-store'

export function SharePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { t, countInline } = useI18n()
  const { profile, ready } = useSocial()
  const { reload, focusDeck } = useAppStore()
  const [preview, setPreview] = useState<SharePreview | null>(null)
  const [loadedCode, setLoadedCode] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const teacher = profile?.role === 'teacher'
  const loading = loadedCode !== code

  useEffect(() => {
    let cancel = false
    void (async () => {
      const result = await previewShare(code)
      if (cancel) return
      setPreview(result.preview)
      setMissing(!result.preview && !result.error)
      setError(result.error)
      setLoadedCode(code)
    })()
    return () => {
      cancel = true
    }
  }, [code])

  const openDeck = (deckId: string, kind: SharePreview['kind']) => {
    focusDeck(deckId)
    navigate(kind === 'exercise' ? `/exercises/${deckId}` : `/decks/${deckId}`)
  }

  const add = async () => {
    if (busy || !preview || preview.own || teacher) return
    setBusy(true)
    setError(null)
    const result = await redeemShare(code)
    if (result.error || !result.redeemed) {
      setBusy(false)
      setError(result.error ?? t('class.badCode'))
      return
    }
    await reload()
    setBusy(false)
    openDeck(result.redeemed.deckId, result.redeemed.kind)
  }

  const kindLabel = preview?.kind === 'exercise' ? t('share.kindExercise') : t('share.kindDeck')

  return (
    <Page>
      <header className="mb-6 pt-2">
        <h1 className="font-display text-3xl">{t('share.title')}</h1>
      </header>
      {loading || !ready ? (
        <p className="text-sm text-muted">{t('common.loading')}</p>
      ) : (
        <Card className="max-w-lg px-4 py-5">
          {preview ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <AvatarBadge avatar={preview.teacherAvatar} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">@{preview.teacherUsername}</p>
                  <p className="text-sm text-muted">
                    {kindLabel} · {countInline('cards', preview.cards)}
                  </p>
                </div>
              </div>
              <h2 className="font-display text-2xl leading-tight">{preview.title}</h2>
            </>
          ) : null}
          {preview?.own ? <p className="mt-3 text-sm leading-6 text-muted">{t('share.own')}</p> : null}
          {teacher && preview && !preview.own ? (
            <p className="mt-3 text-sm leading-6 text-muted">{t('class.studentsOnly')}</p>
          ) : null}
          {preview?.already && !preview.own ? <p className="mt-3 text-sm text-muted">{t('share.already')}</p> : null}
          {missing ? <p className="text-sm text-danger">{t('class.badCode')}</p> : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {preview && !teacher && !preview.own && !preview.already ? (
            <Button className="mt-4 w-full" disabled={busy} onClick={() => void add()}>
              {t('share.add')}
            </Button>
          ) : null}
          {preview?.deckId && (preview.own || preview.already) ? (
            <Button className="mt-4 w-full" variant="secondary" onClick={() => openDeck(preview.deckId as string, preview.kind)}>
              {t('share.open')}
            </Button>
          ) : null}
          {!preview ? (
            <Link to="/" className="mt-4 inline-flex text-sm font-semibold text-accent">
              {t('common.back')}
            </Link>
          ) : null}
        </Card>
      )}
    </Page>
  )
}
