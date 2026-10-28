import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AvatarBadge } from '../components/AvatarBadge'
import { Button, Card, Page } from '../components/ui'
import { joinClass, previewClass, type ClassPreview } from '../lib/classroom'
import { useI18n } from '../i18n/translate'
import { useSocial } from '../store/social-store'

export function JoinPage() {
  const { code = '' } = useParams()
  const { t } = useI18n()
  const { profile, ready } = useSocial()
  const [preview, setPreview] = useState<ClassPreview | null>(null)
  const [loadedCode, setLoadedCode] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const teacher = profile?.role === 'teacher'
  const loading = loadedCode !== code

  useEffect(() => {
    let cancel = false
    void (async () => {
      const result = await previewClass(code)
      if (cancel) return
      setPreview(result.preview)
      setMissing(!result.preview && !result.error)
      setError(result.error)
      setNotice(null)
      setLoadedCode(code)
    })()
    return () => {
      cancel = true
    }
  }, [code])

  const join = async () => {
    if (busy || teacher) return
    setBusy(true)
    setError(null)
    const result = await joinClass(code)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotice(result.already ? t('class.already') : t('class.joined', { name: result.username ?? '' }))
    setPreview((current) => (current ? { ...current, already: true } : current))
  }

  return (
    <Page>
      <header className="mb-6 pt-2">
        <h1 className="font-display text-3xl">{t('class.joinTitle')}</h1>
      </header>
      {loading || !ready ? (
        <p className="text-sm text-muted">{t('common.loading')}</p>
      ) : (
        <Card className="max-w-lg px-4 py-5">
          {preview ? (
            <div className="mb-4 flex items-center gap-3">
              <AvatarBadge avatar={preview.avatar} />
              <p className="text-sm leading-6">{t('class.joinText', { name: preview.username })}</p>
            </div>
          ) : null}
          {teacher ? <p className="text-sm leading-6 text-muted">{t('class.studentsOnly')}</p> : null}
          {missing ? <p className="text-sm text-danger">{t('class.badCode')}</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          ) : null}
          {!teacher && preview && !notice ? (
            <Button className="mt-4 w-full" disabled={busy} onClick={() => void join()}>
              {preview.already ? t('class.already') : t('class.joinAction')}
            </Button>
          ) : null}
          {notice ? (
            <Link to="/" className="mt-4 inline-flex text-sm font-semibold text-accent">
              {t('nav.decks')}
            </Link>
          ) : null}
        </Card>
      )}
    </Page>
  )
}
