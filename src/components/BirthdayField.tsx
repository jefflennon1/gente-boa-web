import { useState } from 'react'
import { BIRTHDAY_MONTHS, daysInBirthdayMonth, splitBirthday } from '../lib/clientFields'

/**
 * Seleção de dia e mês do aniversário. O legado guarda só DD/MM (sem ano), então o valor vai no input oculto
 * {@code name} nesse formato, ou vazio quando dia e mês não foram escolhidos.
 */
export function BirthdayField({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const initial = splitBirthday(defaultValue)
  const [day, setDay] = useState(initial.day)
  const [month, setMonth] = useState(initial.month)
  const lastDay = daysInBirthdayMonth(month)
  const value = day && month ? `${day}/${month}` : ''

  function changeMonth(next: string) {
    setMonth(next)
    if (day && Number(day) > daysInBirthdayMonth(next)) setDay('')
  }

  return (
    <div className="birthday-field">
      <select aria-label="Dia do aniversário" value={day} onChange={(event) => setDay(event.target.value)}>
        <option value="">Dia</option>
        {Array.from({ length: lastDay }, (_, index) => String(index + 1).padStart(2, '0')).map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select aria-label="Mês do aniversário" value={month} onChange={(event) => changeMonth(event.target.value)}>
        <option value="">Mês</option>
        {BIRTHDAY_MONTHS.map((label, index) => {
          const item = String(index + 1).padStart(2, '0')
          return <option key={item} value={item}>{label}</option>
        })}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
