import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({ id, value, onChange, placeholder, autoComplete, className = '' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded opacity-70 hover:opacity-100"
        style={{ color: 'var(--color-text-muted)' }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
