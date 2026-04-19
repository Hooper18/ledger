import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

export default function PasswordInput({
  value, onChange, placeholder, autoComplete,
  required, disabled, id, className,
}: Props) {
  const [show, setShow] = useState(false)

  return (
    <div className={`relative${className ? ' ' + className : ''}`}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setShow(s => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
