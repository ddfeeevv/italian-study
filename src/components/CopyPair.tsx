import { useEffect, useState } from 'react'
import { absoluteUrl, copyText } from '../lib/classroom'
import { useI18n } from '../i18n/translate'
import { Button, Field, Input } from './ui'

export function CopyPair({ code, path }: { code: string; path: string }) {
  const { t } = useI18n()
  const link = absoluteUrl(path)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  useEffect(() => {
    if (!copied) return
    const handle = window.setTimeout(() => setCopied(null), 2000)
    return () => window.clearTimeout(handle)
  }, [copied])

  const copy = async (kind: 'link' | 'code', value: string) => {
    const ok = await copyText(value)
    if (ok) setCopied(kind)
  }

  return (
    <div className="space-y-3">
      <Field label={t('class.link')}>
        <Input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      </Field>
      <Field label={t('class.code')}>
        <Input
          readOnly
          value={code}
          className="font-mono tracking-[0.22em]"
          onFocus={(event) => event.currentTarget.select()}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void copy('link', link)}>
          {copied === 'link' ? t('class.copied') : t('class.copyLink')}
        </Button>
        <Button variant="secondary" onClick={() => void copy('code', code)}>
          {copied === 'code' ? t('class.copied') : t('class.copyCode')}
        </Button>
      </div>
    </div>
  )
}
