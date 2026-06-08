/**
 * AdminOverview.jsx - stats + camera panel (scanner/shower) + live activity feed
 */
import React, { useEffect, useState, useRef } from 'react'
import { Users, Shield, ClipboardList, Camera, Activity, Eye, Scan } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import StatCard from '../../components/StatCard'
import LiveCameraFeed from '../../components/guard/LiveCameraFeed'
import { staffAPI, guardsAPI, visitorsAPI, camerasAPI, logsAPI, adminsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { useNavigate } from 'react-router-dom'
import wsManager from '../../services/websocket'

const BASE = 'http://127.0.0.1:8000'
const ACT_COLORS = {
  SCAN_ACCEPTED:'#22c55e', SCAN_REJECTED:'#ef4444', LOGIN:'#3b82f6',
  LOGOUT:'#6b7280', SPOOF_DETECTED:'#f59e0b', REGISTER:'#06b6d4',
  REQUEST_APPROVE:'#22c55e', REQUEST_DENY:'#ef4444', CAMERA_POWER:'#f59e0b',
}

export default function AdminOverview() {
  const { lang } = useLang()
  const navigate = useNavigate()
  const [stats,   setStats]   = useState({admins:0,staff:0,guards:0,visitors:0,cameras:0})
  const [feed,    setFeed]    = useState([])
  const [cameras, setCameras] = useState([])
  const [camIdx,  setCamIdx]  = useState(0)
  const [mode,    setMode]    = useState('scanner')
  const [loading, setLoading] = useState(true)
  const feedRef = useRef(null)

  useEffect(() => {
    Promise.all([adminsAPI.list(),staffAPI.list(),guardsAPI.list(),visitorsAPI.list(),camerasAPI.list(),logsAPI.history()])
      .then(([a,s,g,v,c,l]) => {
        setStats({
          admins:(a.data.results||a.data).length,
          staff:(s.data.results||s.data).length,
          guards:(g.data.results||g.data).length,
          visitors:(v.data.results||v.data).length,
          cameras:(c.data.results||c.data).length,
        })
        setCameras((c.data.results||c.data).filter(x=>x.power==='on'&&x.status==='active'))
        setFeed((l.data.results||l.data).slice(0,30).map(x=>({...x,_id:x.id})))
      })
      .catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(() => {
    const unsub = wsManager.on('*', (data) => {
      if (!data.type||data.type==='pong') return
      setFeed(prev=>[{
        _id:Date.now(), action_type:data.type.toUpperCase(),
        description:data.visitor_name||data.message||data.type,
        actor_name:data.guard||data.name||'System',
        ethiopian_time:new Date().toLocaleTimeString(),
      },...prev].slice(0,40))
      if (feedRef.current) feedRef.current.scrollTop=0
    })
    return unsub
  }, [])

  const activeCam = cameras[camIdx]
  const L = lang==='am'
    ? {u:'ጠቅላላ ተጠቃሚዎች',g:'ጠባቂዎች',p:'ጎብኚዎች',c:'ንቁ ካሜራዎች',feed:'የቀጥታ እንቅስቃሴ'}
    : {u:'Total Users',g:'Guards',p:'Visitors',c:'Active Cameras',feed:'Live System Activity'}

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={()=>navigate('/admin/staff')}>
          <StatCard icon={Users}        label={L.u} value={stats.admins+stats.staff+stats.guards+stats.visitors} color="#3b82f6"/>
        </div>
        <div className="cursor-pointer" onClick={()=>navigate('/admin/guards')}>
          <StatCard icon={Shield}       label={L.g} value={stats.guards}  color="#8b5cf6"/>
        </div>
        <div className="cursor-pointer" onClick={()=>navigate('/admin/visitors')}>
          <StatCard icon={ClipboardList} label={L.p} value={stats.visitors} color="#f59e0b"/>
        </div>
        <div className="cursor-pointer" onClick={()=>navigate('/admin/cameras')}>
          <StatCard icon={Camera}       label={L.c} value={stats.cameras} color="#cc0000"/>
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Camera panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {cameras.length>0 ? (
              <select value={camIdx} onChange={e=>setCamIdx(Number(e.target.value))}
                      className="ameco-input py-1.5 text-xs" style={{maxWidth:'180px'}}>
                {cameras.map((c,i)=><option key={c.id} value={i}>{c.gate_name} — {c.terminal_id}</option>)}
              </select>
            ) : <span className="text-xs" style={{color:'var(--color-text-muted)'}}>No active cameras</span>}

            <div className="flex rounded-xl overflow-hidden border ml-auto"
                 style={{borderColor:'var(--color-border-main)'}}>
              {[{key:'scanner',icon:Scan,label:'Scanner'},{key:'shower',icon:Eye,label:'Surveillance'}].map(({key,icon:Icon,label})=>(
                <button key={key} onClick={()=>setMode(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all"
                        style={{background:mode===key?'#cc0000':'var(--color-card-main)',color:mode===key?'white':'var(--color-text-muted)'}}>
                  <Icon size={12}/> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{height:'340px'}}>
            {activeCam ? (
              <LiveCameraFeed key={`${activeCam.terminal_id}-${mode}`}
                assignedGateId={activeCam.terminal_id} displayOnly={mode==='shower'} fullScreen={false}/>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl"
                   style={{background:'var(--color-card-main)',border:'1px solid var(--color-border-main)'}}>
                <Camera size={40} style={{color:'var(--color-text-muted)'}}/>
                <p className="text-sm mt-2" style={{color:'var(--color-text-muted)'}}>No active cameras</p>
                <button onClick={()=>navigate('/admin/cameras')}
                        className="mt-3 text-xs font-bold px-4 py-2 rounded-xl text-white"
                        style={{background:'#cc0000'}}>Add Camera</button>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="flex flex-col rounded-2xl overflow-hidden"
             style={{background:'var(--color-card-main)',border:'1px solid var(--color-border-main)',height:'400px'}}>
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
               style={{borderColor:'var(--color-border-main)'}}>
            <Activity size={14} style={{color:'#cc0000'}}/>
            <p className="text-xs font-black uppercase tracking-wider" style={{color:'var(--color-text-main)'}}>{L.feed}</p>
            <span className="flex items-center gap-1 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full status-dot-live" style={{background:'#cc0000'}}/>
              <span className="text-[9px] font-black" style={{color:'#cc0000'}}>LIVE</span>
            </span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                     style={{borderColor:'#cc0000',borderTopColor:'transparent'}}/>
              </div>
            ) : feed.map((entry,i) => {
              const color = ACT_COLORS[entry.action_type]||'#6b7280'
              return (
                <motion.div key={entry._id||i} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} layout
                            className="flex items-center gap-3 px-4 py-3 border-b"
                            style={{borderColor:'var(--color-border-main)'}}>
                  <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0"
                       style={{background:'var(--color-card-hover)'}}>
                    {entry.actor_image
                      ? <img src={`${BASE}${entry.actor_image}`} alt="" className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color}}>
                          {(entry.actor_name||'?')[0]?.toUpperCase()}
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold truncate" style={{color:'var(--color-text-main)'}}>
                        {entry.actor_name||entry.actor_username||'System'}
                      </p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{background:`${color}20`,color}}>
                        {entry.action_type}
                      </span>
                    </div>
                    <p className="text-[10px] truncate" style={{color:'var(--color-text-muted)'}}>{entry.description}</p>
                  </div>
                  <p className="text-[9px] font-mono flex-shrink-0" style={{color:'var(--color-text-muted)'}}>
                    {entry.ethiopian_time}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}