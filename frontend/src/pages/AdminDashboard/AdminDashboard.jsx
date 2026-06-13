/**
 * src/pages/AdminDashboard/AdminDashboard.jsx
 * AMECO — Full Admin Dashboard shell with:
 *  - Profile menu (top-left dropdown) with photo, name, tag, logout, theme, language
 *  - Left sidebar: User Management, Request Review, User Registration,
 *    Guard Management, Logs, Camera Management
 *  - All sub-pages routed
 */

import React, { useState, useRef, useEffect } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import {
  Users, ClipboardList, UserPlus, Shield,
  FileText, Camera, ChevronDown, LogOut,
  Sun, Moon, Globe, LayoutDashboard,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'
import logoImage from '../../assets/logo.png'

const BASE_URL = 'http://127.0.0.1:8000'
const getImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

import AdminOverview     from './AdminOverview'
import AdminsPage        from './AdminsPage'
import GuardsPage        from './GuardsPage'
import StaffPage         from './StaffPage'
import VisitorsPage      from './VisitorsPage'
import CamerasPage       from './CamerasPage'
import LogsPage          from './LogsPage'
/* notifications removed */
import SettingsPage      from './SettingsPage'

const NAV = [
  { key:'dashboard',    icon:LayoutDashboard, path:'/admin',          exact:true  },
  { key:'users',        icon:Users,           path:'/admin/staff'                 },
  { key:'requests',     icon:ClipboardList,   path:'/admin/visitors'              },
  { key:'registration', icon:UserPlus,        path:'/admin/admins'                },
  { key:'guards',       icon:Shield,          path:'/admin/guards'                },
  { key:'logs',         icon:FileText,        path:'/admin/logs'                  },
  { key:'cameras',      icon:Camera,          path:'/admin/cameras'               },
]

const LABEL = {
  en:{ dashboard:'Dashboard', users:'Staff Management', requests:'Request Review',
       registration:'Admin Management', guards:'Guard Management',
       logs:'Logs', cameras:'Camera Management' },
  am:{ dashboard:'ዳሽቦርድ', users:'ሰራተኛ አስተዳደር', requests:'ጥያቄ ግምገማ',
       registration:'የአስተዳደር ሥራ', guards:'ጠባቂ አስተዳደር',
       logs:'ምዝግብ ማስታወሻ', cameras:'ካሜራ አስተዳደር' },
}

export default function AdminDashboard() {
  const { user, logout }        = useAuth()
  const { lang, switchLang }    = useLang()
  const { theme, toggle }       = useTheme()
  const navigate                = useNavigate()
  const [profileOpen, setPO]    = useState(false)
  const profileRef              = useRef(null)
  const L = LABEL[lang] || LABEL.en

  useEffect(() => {
    const h = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setPO(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--color-bg-main)' }}>

      {/* ── SIDEBAR ── */}
      <aside className="flex flex-col h-screen sticky top-0 flex-shrink-0"
             style={{ width:'220px', background:'var(--color-bg-secondary)',
                      borderRight:'1px solid var(--color-border-main)', zIndex:40 }}>

        {/* Profile button */}
        <div ref={profileRef} className="relative px-3 py-4 border-b"
             style={{ borderColor:'var(--color-border-main)' }}>
          <button onClick={() => setPO(p=>!p)}
                  className="flex items-center gap-3 w-full rounded-xl px-2 py-2 transition-all"
                  onMouseEnter={e=>e.currentTarget.style.background='var(--color-card-hover)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                 style={{ background:'#cc0000' }}>
              {user?.profile_image_url
                ? <img src={getImageUrl(user.profile_image_url)} alt="" className="w-full h-full object-cover"/>
                : <span className="text-white font-black">
                    {user?.full_name?.[0]?.toUpperCase()||'A'}
                  </span>}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold truncate" style={{ color:'var(--color-text-main)' }}>
                {user?.full_name||user?.username}
              </p>
              <p className="text-xs" style={{ color:'#cc0000' }}>Admin</p>
            </div>
            <ChevronDown size={13} style={{ color:'var(--color-text-muted)',
              transform:profileOpen?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}/>
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div initial={{ opacity:0,y:-8,scale:0.95 }} animate={{ opacity:1,y:0,scale:1 }}
                          exit={{ opacity:0,y:-8,scale:0.95 }} transition={{ duration:0.15 }}
                          className="absolute left-2 right-2 top-full mt-1 rounded-2xl overflow-hidden z-50"
                          style={{ background:'var(--color-card-main)',
                                   border:'1px solid var(--color-border-main)',
                                   boxShadow:'0 20px 50px rgba(0,0,0,0.35)' }}>
                <div className="flex flex-col items-center p-5 border-b"
                     style={{ background:'linear-gradient(135deg,rgba(204,0,0,0.12),transparent)',
                              borderColor:'var(--color-border-main)' }}>
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3"
                       style={{ border:'2.5px solid #cc0000' }}>
                    {user?.profile_image_url
                      ? <img src={getImageUrl(user.profile_image_url)} alt="" className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center" style={{ background:'#cc0000' }}>
                          <span className="text-white font-black text-2xl">
                            {user?.full_name?.[0]?.toUpperCase()||'A'}
                          </span>
                        </div>}
                  </div>
                  <p className="font-black text-sm" style={{ color:'var(--color-text-main)' }}>
                    {user?.full_name||user?.username}
                  </p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full mt-1"
                        style={{ background:'rgba(204,0,0,0.15)', color:'#cc0000' }}>
                    ADMIN
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color:'var(--color-text-muted)' }}>
                      {theme==='dark'?<Moon size={13}/>:<Sun size={13}/>} {theme==='dark'?'Dark':'Light'}
                    </div>
                    <button onClick={toggle} className="w-10 h-5 rounded-full relative"
                            style={{ background:theme==='dark'?'#cc0000':'#ddd' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                           style={{ left:theme==='dark'?'22px':'2px' }}/>
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color:'var(--color-text-muted)' }}>
                      <Globe size={13}/> {lang==='en'?'English':'አማርኛ'}
                    </div>
                    <div className="flex gap-1">
                      {['en','am'].map(l=>(
                        <button key={l} onClick={()=>switchLang(l)}
                                className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                                style={{ background:lang===l?'#cc0000':'var(--color-card-hover)',
                                         color:lang===l?'white':'var(--color-text-muted)' }}>
                          {l==='en'?'EN':'አማ'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                          style={{ color:'#ff6b6b' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(204,0,0,0.1)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <LogOut size={14}/> Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-3 border-b"
             style={{ borderColor:'var(--color-border-main)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background:'white' }}>
            <img src={logoImage} alt="AMECO" className="w-full h-full object-contain p-0.5" />
          </div>
          <div>
            <p className="text-xs font-black" style={{ color:'var(--color-text-main)' }}>AMECO</p>
            <p className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>Access Control</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV.map(({ key, icon:Icon, path, exact }) => (
            <NavLink key={key} to={path} end={exact} className="block">
              {({ isActive }) => (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                     style={{
                       background: isActive ? 'linear-gradient(135deg,#cc0000,#aa0000)' : 'transparent',
                       color: isActive ? 'white' : 'var(--color-text-muted)',
                       boxShadow: isActive ? '0 4px 12px rgba(204,0,0,0.3)' : 'none',
                     }}
                     onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='var(--color-card-hover)' }}
                     onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background='transparent' }}>
                  <Icon size={18} className="flex-shrink-0"/>
                  <span className="flex-1 truncate">{L[key]||key}</span>
                  {/* notification badge removed */}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route index                  element={<AdminOverview />} />
            <Route path="admins/*"        element={<AdminsPage />} />
            <Route path="guards/*"        element={<GuardsPage />} />
            <Route path="staff/*"         element={<StaffPage />} />
            <Route path="visitors/*"      element={<VisitorsPage />} />
            <Route path="cameras/*"       element={<CamerasPage />} />
            <Route path="logs/*"          element={<LogsPage />} />
            {/* notifications page removed */}
            <Route path="settings/*"      element={<SettingsPage />} />
            <Route path="*"               element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}