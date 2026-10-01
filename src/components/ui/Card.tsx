import type { HTMLAttributes } from 'react'
import { cx } from '../../utils/classes'
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) { return <section className={cx('card', className)} {...props} /> }
