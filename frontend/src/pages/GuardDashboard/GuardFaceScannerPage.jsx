/**
 * src/pages/GuardDashboard/GuardFaceScannerPage.jsx
 * AMECO — Full-page face scanner tab for guards.
 * Wraps LiveCameraFeed in a full content area.
 */

import React from 'react'
import { Scan } from 'lucide-react'
import LiveCameraFeed from '../../components/guard/LiveCameraFeed'
import { useAuth } from '../../context/AuthContext'

export default function GuardFaceScannerPage() {
  const { user } = useAuth()

  // Get guard's assigned gate from their profile
  const assignedGate = user?.gate_camera_id || 'GATE-01'

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Page header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background: 'rgba(204,0,0,0.15)' }}>
          <Scan size={20} style={{ color: '#cc0000' }} />
        </div>
        <div>
          <h2 className="text-lg font-black" style={{ color: 'var(--color-text-main)' }}>
            Face Scanner
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Live face recognition · {assignedGate}
          </p>
        </div>

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl"
             style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.2)' }}>
          <span className="w-2 h-2 rounded-full status-dot-live" style={{ background: '#cc0000' }} />
          <span className="text-xs font-black" style={{ color: '#cc0000' }}>
            Real-time Recognition Active
          </span>
        </div>
      </div>

      {/* How it works info */}
      <div className="flex gap-3 flex-shrink-0">
        {[
          { step: '1', text: 'Start the camera' },
          { step: '2', text: 'Person stands in front' },
          { step: '3', text: 'Auto-scan every 2 seconds' },
          { step: '4', text: 'ID card pops up on match' },
        ].map(({ step, text }) => (
          <div key={step}
               className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1"
               style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                  style={{ background: '#cc0000' }}>
              {step}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Camera — takes remaining height */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden"
           style={{ minHeight: '500px' }}>
        <LiveCameraFeed
          assignedGateId={assignedGate}
          displayOnly={false}
          fullScreen={false}
          onLog={(data) => console.log('Scan log:', data)}
          onAlert={(data) => console.warn('Alert:', data)}
        />
      </div>
    </div>
  )
}