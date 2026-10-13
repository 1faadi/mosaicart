import type { ReactNode } from 'react'

export function TitleBar({ children }: { children: ReactNode }) {
  return <div className="titlebar">{children}</div>
}

export function StepFooter({ onPrev, onNext, nextLabel = 'Next', prevLabel = 'Previous', nextDisabled, children }: { onPrev?: () => void; onNext?: () => void; nextLabel?: string; prevLabel?: string; nextDisabled?: boolean; children?: ReactNode }) {
  return (
    <div className="stepfooter">
      {onPrev ? <button className="pill ghost" onClick={onPrev}>{prevLabel}</button> : <span />}
      {children}
      {onNext ? <button className="pill primary" onClick={onNext} disabled={nextDisabled}>{nextLabel}</button> : <span />}
    </div>
  )
}
