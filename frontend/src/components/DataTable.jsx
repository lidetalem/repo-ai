import React, { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

export default function DataTable({
  columns, data,
  loading = false,
  searchKeys = [],
  pageSize = 10,
  actions,
}) {
  const { t } = useLang()
  const [query, setQuery]   = useState('')
  const [page, setPage]     = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return data
    const q = query.toLowerCase()
    return data.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(q))
    )
  }, [data, query, searchKeys])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSearch = (e) => { setQuery(e.target.value); setPage(1) }

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>

      {/* Search bar */}
      {searchKeys.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-main)' }}>
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              placeholder={t('search')}
              className="ameco-input pl-9 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-main)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {col.label}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}
                    className="text-center py-16"
                    style={{ color: 'var(--color-text-muted)' }}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                         style={{ borderColor: 'var(--color-ameco-red)', borderTopColor: 'transparent' }} />
                    <span className="text-sm">{t('loading')}</span>
                  </div>
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}
                    className="text-center py-16 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}>
                  {t('noData')}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="transition-colors duration-100"
                  style={{ borderBottom: '1px solid var(--color-border-main)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-card-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3" style={{ color: 'var(--color-text-main)' }}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t"
             style={{ borderColor: 'var(--color-border-main)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} records · page {page}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
              style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-main)' }}>
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
              style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-main)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}