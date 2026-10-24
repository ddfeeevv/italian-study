import { clsx } from '../lib/utils'
import mascot from '../assets/mascot.svg'

export function Mascot({ className }: { className?: string }) {
  return (
    <img
      src={mascot}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={clsx('w-auto shrink-0 select-none [image-rendering:pixelated]', className)}
    />
  )
}
