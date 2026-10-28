import type { FaceId, MarkId } from '../lib/avatars'
import { parseAvatar, backgroundColor } from '../lib/avatars'
import { clsx } from '../lib/utils'

const sizes = {
  sm: 'size-8',
  md: 'size-12',
  lg: 'size-16',
}

const skin = '#ffe4cc'
const ink = '#1c1917'

export function AvatarBadge({
  avatar,
  size = 'md',
  className,
}: {
  avatar: string
  size?: keyof typeof sizes
  className?: string
}) {
  const parsed = parseAvatar(avatar)
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={clsx('block shrink-0 overflow-hidden rounded-full', sizes[size], className)}
    >
      <circle cx="32" cy="32" r="32" fill={backgroundColor(parsed.background)} />
      <Face id={parsed.face} />
      {parsed.mark === 'none' ? null : <Mark id={parsed.mark} />}
    </svg>
  )
}

export function MarkGlyph({ id, className }: { id: MarkId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={clsx('size-5', className)}>
      {id === 'none' ? (
        <>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.2 15.8 15.8 8.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : null}
      {id === 'book' ? (
        <path
          d="M4.2 5.8h6.4c.8 1 2 1.5 3.4 1.5V19c-1.4 0-2.6-.5-3.4-1.3H4.2V5.8Zm8.4 1.5c1.4 0 2.6-.5 3.4-1.5h6.4V17.7h-6.4c-.8.8-2 1.3-3.4 1.3V7.3Z"
          fill="currentColor"
        />
      ) : null}
      {id === 'star' ? (
        <path
          d="m12 4.2 1.9 4.2 4.6.5-3.4 3.1.9 4.5L12 14.3 7.9 16.5l1-4.5L5.5 8.9l4.6-.5L12 4.2Z"
          fill="currentColor"
        />
      ) : null}
      {id === 'note' ? (
        <path
          d="M9.2 16.8a2.3 2.3 0 1 1-1.4-2.1V6.2h8.2v2.3H10.6v6.4a2.3 2.3 0 0 1-1.4 1.9Z"
          fill="currentColor"
        />
      ) : null}
      {id === 'leaf' ? (
        <path
          d="M12 4.2c3.8 2.6 5.6 6.6 4.6 11-3.4-1.2-6-3.8-7-7.4.7-1.4 1.6-2.6 2.4-3.6Zm0 0C8.2 6.8 6.4 10.8 7.4 15.2c3.4-1.2 6-3.8 7-7.4-.7-1.4-1.6-2.6-2.4-3.6Z"
          fill="currentColor"
        />
      ) : null}
    </svg>
  )
}

function Eyes({ wink = false }: { wink?: boolean }) {
  return (
    <>
      <circle cx="25" cy="36" r="2.1" fill={ink} />
      {wink ? (
        <path d="M35.2 36.4c1.6-1.8 4-1.8 5.6 0" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <circle cx="39" cy="36" r="2.1" fill={ink} />
      )}
    </>
  )
}

function Smile({ open = false }: { open?: boolean }) {
  return open ? (
    <path d="M26.5 42.5c1.6 3.4 9.4 3.4 11 0v-1.2h-11v1.2Z" fill={ink} />
  ) : (
    <path d="M26.5 42c2 2.6 9 2.6 11 0" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  )
}

function Face({ id }: { id: FaceId }) {
  if (id === 'mira') {
    return (
      <g>
        <path d="M14 34c1-14 8-22 18-22s17 8 18 22c1 12 0 20-3 24-3-9-6-13-15-13s-12 4-15 13c-3-4-4-12-3-24Z" fill="#9a3412" />
        <circle cx="32" cy="36" r="14" fill={skin} />
        <ellipse cx="23.5" cy="40" rx="2.2" ry="1.3" fill="#f0b49a" />
        <ellipse cx="40.5" cy="40" rx="2.2" ry="1.3" fill="#f0b49a" />
        <Eyes />
        <Smile />
      </g>
    )
  }
  if (id === 'nino') {
    return (
      <g>
        <path d="M16 33c0-12 6-20 16-20s16 8 16 20c-2-7-7-11-16-11s-14 4-16 11Z" fill={ink} />
        <circle cx="32" cy="37" r="14" fill={skin} />
        <Eyes />
        <Smile />
      </g>
    )
  }
  if (id === 'cleo') {
    return (
      <g>
        <circle cx="32" cy="16" r="6.5" fill="#5c4570" />
        <path d="M17 34c1-11 6-18 15-18 4 0 7 1.4 10 4-3 2-5 2-8 0-2 6-6 10-12 10-2 0-4-.4-5 0 0-2 0-4 0 4Z" fill="#5c4570" />
        <path d="M18 36c2-8 6-14 14-14s12 6 14 14c-1-5-5-8-14-8s-13 3-14 8Z" fill="#5c4570" />
        <circle cx="32" cy="38" r="13" fill={skin} />
        <Eyes />
        <path d="M27 43h10" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    )
  }
  if (id === 'otto') {
    return (
      <g>
        <path d="M17 34c0-12 6-19 15-19s15 7 15 19c-2-6-6-9-15-9s-13 3-15 9Z" fill="#3f342c" />
        <circle cx="32" cy="36" r="13.5" fill={skin} />
        <path d="M22 43c1.4 6 18.6 6 20 0-2.4 2.6-7 3.6-10 3.6s-7.6-1-10-3.6Z" fill="#3f342c" />
        <path d="M21 32.5h6M37 32.5h6" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <Eyes />
        <path d="M27.5 41.5h9" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    )
  }
  if (id === 'lumi') {
    return (
      <g>
        <path d="M13 32c2-14 9-20 19-20s17 6 19 20c2 14 1 22-2 26-4-10-7-14-17-14s-13 4-17 14c-3-4-4-12-2-26Z" fill="#1f4d56" />
        <circle cx="32" cy="36" r="13.5" fill={skin} />
        <ellipse cx="23.5" cy="40.5" rx="2.1" ry="1.2" fill="#f0b49a" />
        <ellipse cx="40.5" cy="40.5" rx="2.1" ry="1.2" fill="#f0b49a" />
        <path d="M22 35.5c1.4-2 3.6-2 5 0M37 35.5c1.4-2 3.6-2 5 0" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Smile />
      </g>
    )
  }
  if (id === 'pino') {
    return (
      <g>
        <path d="M18 30 22 14l5 14 5-16 5 16 5-13 4 15c-2-5-6-8-14-8s-12 3-14 8Z" fill="#245c38" />
        <circle cx="32" cy="38" r="13.5" fill={skin} />
        <Eyes />
        <Smile open />
      </g>
    )
  }
  if (id === 'sora') {
    return (
      <g>
        <ellipse cx="31" cy="20" rx="16" ry="8" fill="#9a3412" />
        <path d="M18 28c8-2 20-2 28 0-1 3-3 4-6 3 1-2-16-2-16 0-3 1-5 0-6-3Z" fill="#7a2a10" />
        <circle cx="32" cy="38" r="13.5" fill={skin} />
        <ellipse cx="24" cy="42" rx="2" ry="1.2" fill="#f0b49a" />
        <Eyes wink />
        <Smile />
      </g>
    )
  }
  return (
    <g>
      <path d="M17 33c1-12 6-19 13-19 5 0 8 2 11 6 2-3 5-6 9-6 0 8-1 14-4 18-2-6-6-10-12-10s-12 4-17 11Z" fill={ink} />
      <circle cx="32" cy="38" r="13.5" fill={skin} />
      <circle cx="25.5" cy="37" r="4.3" fill="none" stroke={ink} strokeWidth="1.6" />
      <circle cx="38.5" cy="37" r="4.3" fill="none" stroke={ink} strokeWidth="1.6" />
      <path d="M29.6 37h4.8" stroke={ink} strokeWidth="1.6" />
      <circle cx="25.5" cy="37" r="1.5" fill={ink} />
      <circle cx="38.5" cy="37" r="1.5" fill={ink} />
      <Smile />
    </g>
  )
}

function Mark({ id }: { id: Exclude<MarkId, 'none'> }) {
  return (
    <g>
      <circle cx="50" cy="50" r="9" fill="#fffaf4" stroke={ink} strokeWidth="1.4" />
      {id === 'book' ? (
        <>
          <path d="M44.6 47.6c1.8 1.4 3.5 1.9 5.4 1.9s3.6-.5 5.4-1.9v6.2c-1.8 1-3.6 1.4-5.4 1.4s-3.6-.4-5.4-1.4v-6.2Z" fill={ink} />
          <path d="M50 49.4v6" stroke="#fffaf4" strokeWidth="0.9" />
        </>
      ) : null}
      {id === 'star' ? (
        <path d="m50 44.6 1.4 3 3.2.3-2.4 2.2.7 3.2L50 51.6l-2.9 1.7.7-3.2-2.4-2.2 3.2-.3 1.4-3Z" fill={ink} />
      ) : null}
      {id === 'note' ? (
        <>
          <circle cx="47.2" cy="52.8" r="2.3" fill={ink} />
          <rect x="49.1" y="45.2" width="1.7" height="7.8" rx="0.4" fill={ink} />
          <path d="M50.8 45.2h4.4v2.2c-1.6.2-3 .5-4.4.8V45.2Z" fill={ink} />
        </>
      ) : null}
      {id === 'leaf' ? (
        <path d="M50 44.8c3.6 2.4 4.8 6.2 3 8.8-2.8-1.4-4.6-4-4.8-6.6.5-.9 1.2-1.6 1.8-2.2Zm0 0c-3.6 2.4-4.8 6.2-3 8.8 2.8-1.4 4.6-4 4.8-6.6-.5-.9-1.2-1.6-1.8-2.2Z" fill={ink} />
      ) : null}
    </g>
  )
}
