import React from 'react'

export default function Avatar({ src, name = '', size = 36, className = '' }) {
  const initials = (name || '').split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()
  const style = {
    width: size + 'px',
    height: size + 'px',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'inline-block',
    background: 'var(--color-card-hover)'
  }
  const textStyle = {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#f59e0b', fontWeight: 700, fontSize: Math.max(12, Math.floor(size/3))+'px'
  }

  if (src) return <img src={src} alt={name} className={className} style={{ width: style.width, height: style.height, objectFit: 'cover', borderRadius: '8px' }} />

  return (
    <div className={className} style={style}>
      <div style={textStyle}>{initials || '—'}</div>
    </div>
  )
}
