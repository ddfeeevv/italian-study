import type { CSSProperties } from 'react'
import { clsx } from '../lib/utils'

type Pose = 'idle' | 'done' | 'peek'

const ink = {
  '--mascot-belly': 'color-mix(in srgb, var(--card) 62%, var(--accent))',
  '--mascot-wing': 'color-mix(in srgb, var(--accent) 55%, black)',
  '--mascot-beak': 'color-mix(in srgb, var(--accent) 35%, black)',
} as CSSProperties

export function Mascot({ pose = 'idle', className }: { pose?: Pose; className?: string }) {
  const flying = pose === 'done'
  return (
    <svg
      viewBox={flying ? '0 0 210 156' : '0 0 180 124'}
      aria-hidden="true"
      className={clsx('shrink-0 text-accent', flying ? 'mascot-glide' : 'animate-rise', className)}
      style={ink}
    >
      {flying ? <Flight /> : <Perched tilt={pose === 'peek'} />}
    </svg>
  )
}

function Perched({ tilt }: { tilt: boolean }) {
  return (
    <g transform={tilt ? 'translate(180 0) scale(-1 1)' : undefined}>
      <path d="M86 58C54 46 24 32 6 16 34 40 60 56 92 70Z" fill="currentColor" />
      <path d="M90 70C56 86 28 106 12 122 40 104 66 86 98 76Z" fill="currentColor" />
      <ellipse cx="114" cy="76" rx="30" ry="18" fill="currentColor" />
      <path d="M104 60c16-2 26 12 16 26-14-4-28-2-40 8 4-14 10-28 24-34z" fill="var(--mascot-wing)" />
      <ellipse cx="120" cy="82" rx="13" ry="8" fill="var(--mascot-belly)" />
      <ellipse cx="126" cy="64" rx="14" ry="10" fill="currentColor" />
      <g transform={tilt ? 'rotate(-28 122 70)' : undefined}>
        <circle cx="136" cy="54" r="16" fill="currentColor" />
        <path d="M148 49c14-1 22 4 20 8-12 0-16 2-20 4 1-4 1-9 0-12z" fill="var(--mascot-beak)" />
        <circle cx="140" cy="51" r="2.7" fill="var(--fg)" />
        <circle cx="140.9" cy="50.2" r="0.85" fill="var(--card)" />
      </g>
      <path
        d="M102 94v12M97 106h10M100 106l-5 5M126 94v12M121 106h10M124 106l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M70 108h72"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.4"
      />
    </g>
  )
}

function Flight() {
  return (
    <>
      <path d="M116 78C82 66 48 54 24 42 56 62 86 74 118 84Z" fill="currentColor" />
      <path d="M118 88C80 108 46 126 30 136 60 118 90 102 120 92Z" fill="currentColor" />
      <path d="M126 72C92 34 46 6 14 12 44 32 84 54 130 78Z" fill="currentColor" />
      <path d="M122 92C90 118 54 142 40 150 72 130 100 110 128 96Z" fill="currentColor" />
      <ellipse cx="142" cy="84" rx="26" ry="14" fill="currentColor" />
      <ellipse cx="148" cy="88" rx="11" ry="6.5" fill="var(--mascot-belly)" />
      <circle cx="166" cy="68" r="14" fill="currentColor" />
      <path d="M178 63c14-1 22 5 20 9-12 0-16 2-20 4 1-4 1-10 0-13z" fill="var(--mascot-beak)" />
      <circle cx="170" cy="65" r="2.5" fill="var(--fg)" />
      <circle cx="170.8" cy="64.2" r="0.8" fill="var(--card)" />
    </>
  )
}
