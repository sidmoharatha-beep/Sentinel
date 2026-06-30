import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { dashboardApi, api } from '@/lib/api';
import { RefreshCw, ShieldCheck, AlertTriangle, MapPin, Users, Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHECKPOINTS = [
  { id:18, code:'ETP01',  name:'ETP',               lat:20.171531, lng:85.655147, type:'operational' },
  { id:19, code:'VOY01',  name:'Veg Oil Yard',       lat:20.170960, lng:85.656346, type:'critical' },
  { id:20, code:'LPG01',  name:'LPG Yard',           lat:20.170529, lng:85.657595, type:'critical' },
  { id:21, code:'LDP01',  name:'Loading Point',      lat:20.171677, lng:85.658172, type:'critical' },
  { id:22, code:'SST01',  name:'Sub Station',        lat:20.170329, lng:85.656117, type:'operational' },
  { id:23, code:'SCY01',  name:'Scrap Yard',         lat:20.170173, lng:85.654894, type:'operational' },
  { id:24, code:'PRE01',  name:'Process Entrance',   lat:20.169881, lng:85.657440, type:'critical' },
  { id:25, code:'RMA01',  name:'RM Area',            lat:20.169320, lng:85.656989, type:'operational' },
  { id:26, code:'SDA01',  name:'Scrap/Dumping Area', lat:20.169429, lng:85.656524, type:'operational' },
  { id:27, code:'BAS01',  name:'Biscuit Area/Store', lat:20.170362, lng:85.656631, type:'operational' },
  { id:28, code:'FGS01',  name:'FG Stock Yard',      lat:20.171638, lng:85.656935, type:'operational' },
  { id:29, code:'FGD01',  name:'FG Dock',            lat:20.171295, lng:85.657593, type:'operational' },
  { id:30, code:'PMD01',  name:'PM Dock',            lat:20.170648, lng:85.657375, type:'operational' },
];
const PLANT_CENTER = { lat: 20.1705, lng: 85.6565 };
const GUARD_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#06b6d4','#f97316'];

function parseUTC(iso: string) {
  return new Date(iso.includes('Z')||iso.includes('+')?iso:iso+'Z');
}
function minutesAgo(iso: string) {
  return Math.round((Date.now()-parseUTC(iso).getTime())/60000);
}
function fmtTime(iso: string) {
  return parseUTC(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false});
}

export default function LiveMap() {
  const mapRef     = useRef<any>(null);
  const mapElRef   = useRef<HTMLDivElement|null>(null);
  const markersRef = useRef<Record<string,any>>({});
  const LRef       = useRef<any>(null);

  const [timeline, setTimeline]           = useState<any[]>([]);
  const [activePatrols, setActivePatrols] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedGuard, setSelectedGuard] = useState<string|null>(null);
  const [lastRefresh, setLastRefresh]     = useState(new Date());

  // Init map lazily
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css');
      LRef.current = L.default || L;
      const Lx = LRef.current;
      const map = Lx.map(mapElRef.current!, { center:[PLANT_CENTER.lat,PLANT_CENTER.lng], zoom:17 });
      Lx.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution:'© Esri', maxZoom:20 }).addTo(map);
      Lx.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { attribution:'', maxZoom:20, opacity:0.5 }).addTo(map);

      // Checkpoint markers
      CHECKPOINTS.forEach((cp, i) => {
        const isCrit = cp.type === 'critical';
        const icon = Lx.divIcon({
          className:'',
          html:`<div style="width:26px;height:26px;border-radius:50%;background:${isCrit?'#ef4444':'#3b82f6'};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i+1}</div>`,
          iconSize:[26,26], iconAnchor:[13,13],
        });
        Lx.marker([cp.lat,cp.lng],{icon}).addTo(map)
          .bindPopup(`<b>${cp.name}</b><br/><small>${cp.code} · ${cp.type}</small>`);
      });

      mapRef.current = map;
    });
    return () => { if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0,10);
      const [tl, patrols]: any[] = await Promise.all([
        dashboardApi.photoTimeline(today),
        (api.get as any)('/patrols?status=in_progress&limit=50'),
      ]);
      setTimeline(tl.timeline||[]);
      setActivePatrols(patrols.patrols||[]);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const id = setInterval(loadData,30000); return ()=>clearInterval(id); }, [loadData]);

  // Update guard markers
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    const Lx = LRef.current;
    const latestByGuard: Record<string,any> = {};
    for (const e of timeline) {
      if (!e.latitude||!e.longitude) continue;
      if (!latestByGuard[e.employee_id]||e.scanned_at>latestByGuard[e.employee_id].scanned_at)
        latestByGuard[e.employee_id] = e;
    }
    Object.values(latestByGuard).forEach((g:any,idx)=>{
      const color = GUARD_COLORS[idx%GUARD_COLORS.length];
      const mins  = minutesAgo(g.scanned_at);
      const sel   = selectedGuard===g.employee_id;
      const sz = sel?38:30;
      const icon = Lx.divIcon({
        className:'',
        html:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};border:${sel?'3px solid #fbbf24':'2px solid white'};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.5);position:relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          ${mins<=5?'<div style="position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:50%;background:#22c55e;border:1.5px solid white"></div>':''}
        </div>`,
        iconSize:[sz,sz], iconAnchor:[sz/2,sz/2],
      });
      const popup = `<b>${g.guard_name}</b><br/><small>${g.employee_id} · Shift ${g.shift||'—'}</small><br/><small>Last: ${fmtTime(g.scanned_at)} (${mins}m ago)</small><br/><small>📍 ${g.checkpoint_name}</small>`;
      if (markersRef.current[g.employee_id]) {
        markersRef.current[g.employee_id].setLatLng([g.latitude,g.longitude]).setIcon(icon).bindPopup(popup);
      } else {
        markersRef.current[g.employee_id] = Lx.marker([g.latitude,g.longitude],{icon})
          .addTo(mapRef.current).bindPopup(popup)
          .on('click',()=>setSelectedGuard(id=>id===g.employee_id?null:g.employee_id));
      }
    });
    Object.keys(markersRef.current).forEach(id=>{
      if(!latestByGuard[id]){markersRef.current[id].remove();delete markersRef.current[id];}
    });
  }, [timeline, selectedGuard]);

  // Derive guard list and checkpoint status
  const guardMap: Record<string,any> = {};
  for (const t of timeline) {
    if (!guardMap[t.employee_id]) guardMap[t.employee_id]={...t,scan_count:0};
    guardMap[t.employee_id].scan_count++;
    if (t.scanned_at>guardMap[t.employee_id].scanned_at) guardMap[t.employee_id]={...t,scan_count:guardMap[t.employee_id].scan_count};
  }
  const guards = Object.values(guardMap);
  const scannedCodes = new Set(timeline.map((t:any)=>t.checkpoint_code));

  return (
    <Layout>
      <div className="flex flex-col -mt-4 -mx-4" style={{height:'calc(100vh - 64px)'}}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-border shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <MapPin size={15} className="text-accent"/> Live Map — ITC ICML, Khordha
            </h2>
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> Auto-refresh 30s
            </span>
            <span className="text-xs text-text-muted hidden sm:block">
              Updated: {lastRefresh.toLocaleTimeString('en-IN',{hour12:false})}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/> Critical CP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"/> Operational CP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/> Guard active</span>
            <button onClick={loadData} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-alt">
              <RefreshCw size={11} className={loading?'animate-spin':''}/> Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* MAP */}
          <div className="flex-1 relative">
            <div ref={mapElRef} style={{width:'100%',height:'100%'}}/>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-[1000]">
                <Loader2 size={22} className="animate-spin text-accent"/>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="w-64 border-l border-border bg-white flex flex-col overflow-hidden shrink-0">
            {/* Stats */}
            <div className="p-3 border-b border-border grid grid-cols-2 gap-2">
              {[
                {label:'Active Patrols', val:activePatrols.length, icon:<Activity size={13} className="text-blue-600"/>, bg:'bg-blue-50'},
                {label:'Guards on Map',  val:guards.length,         icon:<Users size={13} className="text-green-600"/>,  bg:'bg-green-50'},
                {label:'CPs Visited',   val:scannedCodes.size,     icon:<ShieldCheck size={13} className="text-purple-600"/>, bg:'bg-purple-50'},
                {label:'CPs Pending',   val:13-scannedCodes.size,  icon:<AlertTriangle size={13} className="text-amber-600"/>, bg:'bg-amber-50'},
              ].map(s=>(
                <div key={s.label} className="p-2 rounded-xl border border-border">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center mb-1',s.bg)}>{s.icon}</div>
                  <p className="text-base font-bold text-primary">{s.val}</p>
                  <p className="text-[10px] text-text-muted leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Guards */}
            <div className="flex-1 overflow-y-auto">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide px-3 pt-2 pb-1">Guards ({guards.length})</p>
              {guards.length===0 ? (
                <p className="px-3 py-6 text-center text-xs text-text-muted">No guard activity today</p>
              ) : guards.map((g:any,idx)=>{
                const mins = minutesAgo(g.scanned_at);
                const color = GUARD_COLORS[idx%GUARD_COLORS.length];
                const sel = selectedGuard===g.employee_id;
                return (
                  <button key={g.employee_id} onClick={()=>{
                    setSelectedGuard(id=>id===g.employee_id?null:g.employee_id);
                    if (g.latitude&&g.longitude&&mapRef.current) {
                      mapRef.current.flyTo([g.latitude,g.longitude],18,{duration:1});
                      markersRef.current[g.employee_id]?.openPopup();
                    }
                  }} className={cn('w-full text-left px-3 py-2 border-b border-border hover:bg-surface-alt',
                    sel&&'bg-accent/5 border-l-2 border-l-accent')}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{background:color}}>{g.guard_name?.charAt(0)||'G'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-semibold text-primary truncate">{g.guard_name}</p>
                          <span className={cn('text-[10px] font-medium px-1 py-0.5 rounded-full',
                            mins>90?'bg-red-50 text-red-600':'bg-green-50 text-green-600')}>{mins}m</span>
                        </div>
                        <p className="text-[10px] text-text-muted truncate">📍 {g.checkpoint_name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Checkpoint status */}
            <div className="border-t border-border">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide px-3 pt-2 pb-1">Checkpoints</p>
              <div className="overflow-y-auto max-h-40 pb-2">
                {CHECKPOINTS.map((cp,i)=>{
                  const done = scannedCodes.has(cp.code);
                  return (
                    <div key={cp.id} onClick={()=>mapRef.current?.flyTo([cp.lat,cp.lng],19,{duration:1})}
                      className="flex items-center gap-2 px-3 py-1 hover:bg-surface-alt cursor-pointer">
                      <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0',
                        done?'bg-green-500':cp.type==='critical'?'bg-red-400':'bg-gray-300')}>
                        {done?'✓':i+1}
                      </div>
                      <p className={cn('text-[10px] truncate',done?'text-green-700 font-medium':'text-text-muted')}>{cp.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
