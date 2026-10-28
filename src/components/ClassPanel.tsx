import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cleanCode,
  joinClass,
  leaveClass,
  loadMyTeachers,
  redeemShare,
  type MyTeacher,
} from '../lib/classroom'
import { useI18n } from '../i18n/translate'
import { useAppStore } from '../store/app-store'
import { AvatarBadge } from './AvatarBadge'
import { Button, Card, Field, Input, List } from './ui'

export function ClassPanel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { reload, focusDeck } = useAppStore()
  const [teacherCode, setTeacherCode] = useState('')
  const [materialCode, setMaterialCode] = useState('')
  const [teachers, setTeachers] = useState<MyTeacher[]>([])
  const [blocked, setBlocked] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState<'join' | 'add' | string | null>(null)

  const refresh = async () => {
    const result = await loadMyTeachers()
    if (result.error) {
      setTeachers([])
      setBlocked(result.error)
      return
    }
    setBlocked(null)
    setTeachers(result.teachers)
  }

  useEffect(() => {
    let cancel = false
    void (async () => {
      const result = await loadMyTeachers()
      if (cancel) return
      if (result.error) {
        setTeachers([])
        setBlocked(result.error)
        return
      }
      setBlocked(null)
      setTeachers(result.teachers)
    })()
    return () => {
      cancel = true
    }
  }, [])

  const join = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy('join')
    setBanner(null)
    const result = await joinClass(teacherCode)
    setBusy(null)
    if (result.error) {
      setBanner({ tone: 'err', text: result.error })
      return
    }
    setTeacherCode('')
    setBanner({
      tone: 'ok',
      text: result.already ? t('class.already') : t('class.joined', { name: result.username ?? '' }),
    })
    await refresh()
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy('add')
    setBanner(null)
    const result = await redeemShare(materialCode)
    if (result.error || !result.redeemed) {
      setBusy(null)
      setBanner({ tone: 'err', text: result.error ?? t('class.badCode') })
      return
    }
    await reload()
    focusDeck(result.redeemed.deckId)
    setBusy(null)
    setMaterialCode('')
    const path = result.redeemed.kind === 'exercise' ? `/exercises/${result.redeemed.deckId}` : `/decks/${result.redeemed.deckId}`
    navigate(path)
  }

  const leave = async (teacher: MyTeacher) => {
    if (busy) return
    if (!window.confirm(t('class.confirmLeave', { name: teacher.username }))) return
    setBusy(teacher.classroomId)
    setBanner(null)
    const error = await leaveClass(teacher.classroomId)
    setBusy(null)
    if (error) {
      setBanner({ tone: 'err', text: error })
      return
    }
    await refresh()
  }

  return (
    <Card className="mt-4 px-4 py-4">
      <h2 className="text-sm font-semibold">{t('class.teachers')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{blocked ?? t('class.accountLead')}</p>
      {banner ? (
        <p
          role={banner.tone === 'err' ? 'alert' : 'status'}
          className={banner.tone === 'err' ? 'mt-3 text-sm text-danger' : 'mt-3 text-sm text-success'}
        >
          {banner.text}
        </p>
      ) : null}

      {teachers.length > 0 ? (
        <List className="mt-4">
          {teachers.map((teacher) => (
            <div key={teacher.classroomId} className="flex items-center gap-3 px-4 py-3">
              <AvatarBadge avatar={teacher.avatar} />
              <p className="min-w-0 flex-1 truncate font-semibold">@{teacher.username}</p>
              <Button
                className="shrink-0 px-3"
                variant="secondary"
                disabled={busy === teacher.classroomId}
                onClick={() => void leave(teacher)}
              >
                {t('class.leave')}
              </Button>
            </div>
          ))}
        </List>
      ) : blocked ? null : (
        <p className="mt-3 text-sm text-muted">{t('class.noTeachers')}</p>
      )}

      <form className="mt-4 space-y-3" onSubmit={(event) => void join(event)}>
        <Field label={t('class.teacherCode')}>
          <Input
            value={teacherCode}
            onChange={(event) => setTeacherCode(cleanCode(event.target.value))}
            placeholder="AB12CD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Button className="w-full" type="submit" disabled={busy !== null || teacherCode.length !== 6}>
          {t('class.joinAction')}
        </Button>
      </form>

      <form className="mt-4 space-y-3" onSubmit={(event) => void add(event)}>
        <Field label={t('class.materialCode')}>
          <Input
            value={materialCode}
            onChange={(event) => setMaterialCode(cleanCode(event.target.value))}
            placeholder="AB12CD34"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Button className="w-full" type="submit" variant="secondary" disabled={busy !== null || materialCode.length !== 8}>
          {t('class.addMaterial')}
        </Button>
      </form>
    </Card>
  )
}
