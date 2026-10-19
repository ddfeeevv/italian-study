import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AccentBar } from '../components/session/AccentBar'
import { Button, Card, Field, Input, Page, Textarea } from '../components/ui'
import { linesToCards, parseBulkText } from '../lib/import-export'
import { createCard } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import type { CardType } from '../types/models'
import { TYPE_LABELS } from '../types/models'

export function AddWordsPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { decks, addCards } = useAppStore()
  const [deckId, setDeckId] = useState(params.get('deck') ?? decks[0]?.id ?? '')
  const [type, setType] = useState<CardType>('vocab')
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [sentence, setSentence] = useState('')
  const [target, setTarget] = useState('')
  const [options, setOptions] = useState('')
  const [explanation, setExplanation] = useState('')
  const [bulk, setBulk] = useState('')
  const [message, setMessage] = useState('')

  const preview = useMemo(() => parseBulkText(bulk), [bulk])

  const addOne = () => {
    if (!deckId || !user) return
    addCards([
      createCard({
        deckId,
        userId: user.id,
        type,
        term: type === 'cloze' ? term || target : term,
        translation,
        sentence,
        target: target || term,
        options: options.split(',').map((part) => part.trim()).filter(Boolean),
        explanation,
      }),
    ])
    setTerm('')
    setTranslation('')
    setSentence('')
    setTarget('')
    setOptions('')
    setExplanation('')
    setMessage('Карточка добавлена и уже в очереди на сегодня.')
  }

  const addBulk = () => {
    if (!deckId || !user || preview.length === 0) return
    addCards(linesToCards(deckId, user.id, preview))
    setBulk('')
    setMessage(`Импортировано ${preview.length} карточек.`)
  }

  const canSave =
    type === 'vocab' ? term.trim() && translation.trim() : type === 'cloze' ? sentence.includes('{blank}') && target.trim() : term.trim() && target.trim()

  return (
    <Page>
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Пополнение</p>
        <h1 className="mt-1 font-display text-3xl">Карточка</h1>
      </header>

      {decks.length === 0 ? (
        <Card className="px-5 py-6 text-sm text-muted">Сначала создайте колоду на главном экране.</Card>
      ) : (
        <div className="space-y-6">
          <Field label="Колода">
            <select
              value={deckId}
              onChange={(event) => setDeckId(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-fg outline-none"
            >
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          </Field>

          <Card className="space-y-4 px-4 py-5">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 text-sm">
              {(['vocab', 'cloze', 'transform'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setType(id)}
                  className={type === id ? 'min-h-10 rounded-xl bg-card font-semibold' : 'min-h-10 rounded-xl text-muted'}
                >
                  {TYPE_LABELS[id]}
                </button>
              ))}
            </div>
            {type === 'cloze' ? (
              <Field label="Предложение с {blank}">
                <Input value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder="Noi {blank} la metro." />
              </Field>
            ) : (
              <Field label={type === 'transform' ? 'Исходная форма' : 'Слово'}>
                <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={type === 'transform' ? 'la casa nuova (plurale)' : 'lavorare'} />
              </Field>
            )}
            {type === 'vocab' ? (
              <Field label="Перевод">
                <Input value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder="работать" />
              </Field>
            ) : (
              <Field label="Правильный ответ">
                <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={type === 'cloze' ? 'prendiamo' : 'le case nuove'} />
              </Field>
            )}
            {type === 'cloze' ? (
              <Field label="Подсказка">
                <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="prendere" />
              </Field>
            ) : null}
            {type !== 'vocab' ? (
              <Field label="4 варианта (необязательно)">
                <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="prendo, prendiamo, prendete, prendono" />
              </Field>
            ) : null}
            <Field label="Объяснение при ошибке">
              <Input value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Перед S + согласная используется LO" />
            </Field>
            <Button className="w-full" disabled={!canSave} onClick={addOne}>
              Добавить
            </Button>
          </Card>

          <Card className="space-y-4 px-4 py-5">
            <h2 className="font-display text-xl">Пакетный импорт</h2>
            <p className="text-sm leading-6 text-muted">
              Слова: <code className="rounded bg-surface px-1.5">lavorare - работать</code>
              <br />
              Форма / пропуск: <code className="rounded bg-surface px-1.5">Prompt | Target | Explanation</code>
              <br />
              С вариантами: <code className="rounded bg-surface px-1.5">Prompt | Target | a, b, c, d | Explanation</code>
            </p>
            <Textarea
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
              placeholder={
                "lavorare - работать\nNoi {blank} il treno | prendiamo | 1 лицо мн.ч.\nl'amica gentile (мн. число) | le amiche gentili | le amiche gentili, gli amiche gentili, le amiche gentile, i amici gentili | женский род: l'→le"
              }
            />
            {preview.length > 0 ? (
              <p className="text-sm text-muted">
                Распознано: {preview.length}. {preview.slice(0, 3).map((line) => line.target || line.term).join(', ')}
              </p>
            ) : null}
            <Button className="w-full" variant="secondary" disabled={preview.length === 0} onClick={addBulk}>
              Импортировать {preview.length || ''}
            </Button>
          </Card>

          {message ? <p className="text-center text-sm font-medium text-success">{message}</p> : null}
        </div>
      )}
      <AccentBar offset={72} />
    </Page>
  )
}
