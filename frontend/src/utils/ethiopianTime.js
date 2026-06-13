/**
 * ethiopianTime.js — Full Ethiopian Calendar & Local Time utilities
 * Ethiopian calendar: 13 months (12×30 + Pagumē 5-6 days).
 * Ethiopian clock is shifted 6 hours: sunrise (6am Gregorian) = 12:00 Ethiopian.
 */

const ETH_MONTHS_AM = [
  'መስከረም','ጥቅምት','ህዳር','ታህሳስ','ጥር','የካቲት',
  'መጋቢት','ሚያዚያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'
]
const ETH_MONTHS_EN = [
  'Meskerem','Tikimt','Hidar','Tahsas','Tir','Yekatit',
  'Megabit','Miyazia','Ginbot','Sene','Hamle','Nehase','Pagume'
]

function gregorianToJDN(y, m, d) {
  const a  = Math.floor((14 - m) / 12)
  const yr = y + 4800 - a
  const mo = m + 12 * a - 3
  return d + Math.floor((153 * mo + 2) / 5) + 365 * yr +
    Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045
}

function jdnToEthiopian(jdn) {
  const r     = (jdn - 1723856) % 1461
  const n     = r % 365 + 365 * Math.floor(r / 1460)
  const year  = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460)
  const month = Math.floor(n / 30) + 1
  const day   = n % 30 + 1
  return { year, month: Math.min(month, 13), day }
}

export function toEthiopian(date) {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return jdnToEthiopian(jdn)
}

/** Convert a JS Date to Ethiopian local time components */
export function toEthiopianTime(date) {
  // Ethiopia = UTC+3
  const eatHour   = date.getUTCHours() + 3
  const eatHourMod = ((eatHour % 24) + 24) % 24
  // Ethiopian clock: subtract 6 hours (midnight Greg = 18:00 Eth, 6am Greg = 00:00 Eth)
  const ethHour24 = ((eatHourMod - 6) + 24) % 24
  const isDay     = eatHourMod >= 6 && eatHourMod < 18
  return {
    hours:   ethHour24,
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    period:  isDay ? 'ቀን' : 'ማታ',
    periodEn: isDay ? 'Day' : 'Night',
  }
}

export function formatEthiopianDate(date, lang = 'en') {
  const eth    = toEthiopian(date)
  const months = lang === 'am' ? ETH_MONTHS_AM : ETH_MONTHS_EN
  const m      = months[Math.min(eth.month - 1, 12)]
  return lang === 'am'
    ? `${eth.day} ${m} ${eth.year} ዓ.ም`
    : `${eth.day} ${m} ${eth.year} E.C.`
}

export function formatEthiopianTimeOnly(date) {
  const t  = toEthiopianTime(date)
  const hh = String(t.hours).padStart(2, '0')
  const mm = String(t.minutes).padStart(2, '0')
  const ss = String(t.seconds).padStart(2, '0')
  return `${hh}:${mm}:${ss} ${t.period}`
}

export function formatEthiopianDateTime(date, lang = 'en') {
  return `${formatEthiopianDate(date, lang)} · ${formatEthiopianTimeOnly(date)}`
}

/** Format a backend ISO string as Ethiopian date/time */
export function formatBackendDate(isoString, lang = 'en', includeTime = true) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return includeTime ? formatEthiopianDateTime(d, lang) : formatEthiopianDate(d, lang)
  } catch {
    return isoString
  }
}

/** Compact Ethiopian date for tables: "12 Meskerem 2016" */
export function compactEthDate(isoString, lang = 'en') {
  return formatBackendDate(isoString, lang, false)
}

export default { formatEthiopianDateTime, formatEthiopianDate, formatEthiopianTimeOnly, formatBackendDate, compactEthDate, toEthiopian, toEthiopianTime }