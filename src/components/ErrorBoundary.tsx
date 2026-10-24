import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Screen } from './ui'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error }: { error?: Error }) {
  const navigate = useNavigate()

  return (
    <Screen>
      <div className="flex flex-1 items-center px-4 pb-[env(safe-area-inset-bottom)]">
        <EmptyState
          title="Что-то пошло не так"
          text={error?.message || 'Произошла ошибка. Попробуйте вернуться назад.'}
          action={
            <div className="flex w-full flex-col gap-2">
              <Button onClick={() => navigate(-1)}>Назад</Button>
              <Button variant="secondary" onClick={() => { window.location.href = '/' }}>
                На главную
              </Button>
            </div>
          }
        />
      </div>
    </Screen>
  )
}
