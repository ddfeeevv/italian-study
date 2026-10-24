import { clsx } from '../lib/utils'
import mascot from '../assets/mascot.svg'

export function Mascot({ className }: { className?: string }) {
  return (
    <img
      src={mascot}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={200}
      height={200}
      className={clsx('mascot', className)}
    />
  )
}
