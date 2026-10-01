import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cx } from '../../utils/classes'
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean }
export function Button({ variant = 'primary', loading = false, disabled, children, className, type = 'button', ...props }: Props) {
  return <button {...props} type={type} className={cx('button', `button--${variant}`, className)}
    disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <LoaderCircle className="spin" size={18} aria-hidden="true" />}{children}
  </button>
}
export function IconButton({ label, children, className, ...props }: Props & { label: string }) {
  return <Button {...props} variant="ghost" aria-label={label} className={cx('icon-button', className)}>{children}</Button>
}
