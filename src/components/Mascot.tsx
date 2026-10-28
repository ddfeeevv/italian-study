import { clsx } from '../lib/utils'
import mascot from '../assets/mascot.svg'

export function Mascot({ className, size = 200 }: { className?: string; size?: number }) {
  return (
    <img
      src={mascot}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={clsx('mascot', className)}
    />
  )
}
