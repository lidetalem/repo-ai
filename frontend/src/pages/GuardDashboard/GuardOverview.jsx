/**
 * GuardOverview.jsx — Guard main dashboard
 * Stats cards + display-only CCTV camera preview + pending requests callout
 */
import React, { useEffect, useState } from 'react'
import { UserCheck, Clock, CheckCircle, Scan, Camera } from 'lucide-react'
import StatCard from '../../components/StatCard'
import LiveCameraFeed from '../../components/guard/LiveCameraFeed'
import { visitorsAPI, requestsAPI, camerasAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function GuardOverview() {
  const { lang }  = useLang()
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [cameras,  setCameras]  = useState([])
  const [visitors, setVisitors] = useState([])
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([camerasAPI.list(), visitorsAPI.list(), requestsAPI.list()])
      .then(([c, v, r]) => {
        setCameras(c.data.results || c.data)
        setVisitors(v.data.results || v.data)
        setRequests(r.data.results || r.data)
      })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }, [])

  const activeCameras = cameras.filter(c=>c.power==='on'&&c.status==='active')
  const pendingReqs   = requests.filter(r=>r.status==='PENDING')
  const approvedReqs  = requests.filter(r=>r.status==='APPROVED')
  const assignedGate  = user?.gate_camera_id || activeCameras[0]?.terminal_id || 'GATE-01'

  const L = {
    en:{ welcome:'Welcome back', totalVisitors:'Total Visitors', pending:'Pending Requests',
         approved:'Approved', activeCams:'Active Cameras', cctv:'Station Monitor',
         pending_note:'pending visitor request awaiting admin approval' },
    am:{ welcome:'እንኳን ደህና መጡ', totalVisitors:'ጠቅላላ ጎብኚዎች', pending:'በመጠባበቅ ላይ',
         approved:'ጸደቀ', activeCams:'ንቁ ካሜራዎች', cctv:'ጣቢያ ሞኒተር',
         pending_note:'ጸደቃ የሚጠብቅ ጥያቄ' },
  }[lang] || {}

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="rounded-2xl px-6 py-5 flex items-center justify-between"
           style={{ background:'linear-gradient(135deg,rgba(204,0,0,0.15),rgba(136,0,0,0.05))', border:'1px solid rgba(204,0,0,0.2)' }}>
        <div>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{L.welcome},</p>
          <h2 className="text-2xl font-black mt-0.5" style={{ color:'var(--color-text-main)' }}>
            {user?.full_name||user?.username}
          </h2>
          <p className="text-sm mt-1" style={{ color:'#cc0000' }}>Security Guard · AMECO</p>
        </div>

        {/* Quick scanner shortcut */}
        <button
          onClick={()=>navigate('/guard/scanner')}
          className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl text-white transition-all"
          style={{ background:'linear-gradient(135deg,#cc0000,#880000)', boxShadow:'0 8px 24px rgba(204,0,0,0.4)' }}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
          <Scan size={28} className="animate-heartbeat"/>
          <span className="text-xs font-black uppercase tracking-wider">Face Scanner</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={()=>navigate('/guard/visitors')} className="cursor-pointer">
          <StatCard icon={UserCheck}   label={L.totalVisitors}  value={visitors.length}     color="#f59e0b"/>
        </div>
        <div onClick={()=>navigate('/guard/requests')} className="cursor-pointer">
          <StatCard icon={Clock}       label={L.pending}        value={pendingReqs.length}  color="#f59e0b"/>
        </div>
        <StatCard icon={CheckCircle} label={L.approved}       value={approvedReqs.length} color="#22c55e"/>
        <StatCard icon={Camera}      label={L.activeCams}     value={activeCameras.length} color="#cc0000"/>
      </div>

      {/* CCTV display-only camera */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Camera size={16} style={{ color:'#cc0000' }}/>
          <h3 className="text-sm font-bold" style={{ color:'var(--color-text-main)' }}>{L.cctv}</h3>
          <span className="text-xs ml-1" style={{ color:'var(--color-text-muted)' }}>(display only — use Face Scanner tab to scan)</span>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ height:'320px' }}>
          <LiveCameraFeed
            assignedGateId={assignedGate}
            displayOnly={true}
            fullScreen={false}
          />
        </div>
      </div>

      {/* Pending callout */}
      {pendingReqs.length > 0 && (
        <div className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer"
             style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)' }}
             onClick={()=>navigate('/guard/requests')}>
          <Clock size={20} style={{ color:'#f59e0b' }}/>
          <p className="text-sm" style={{ color:'var(--color-text-main)' }}>
            You have <span className="font-black" style={{ color:'#f59e0b' }}>{pendingReqs.length}</span>{' '}
            {L.pending_note}{pendingReqs.length!==1?'s':''}.
          </p>
        </div>
      )}
    </div>
  )
}