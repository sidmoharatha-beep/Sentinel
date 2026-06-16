import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '@/components/Layout';
import {
  ShieldCheck, Clock, MapPin, QrCode, Play, CheckSquare,
  RefreshCw, AlertCircle, Loader2, X, Navigation, CheckCircle2,
  FileText, TriangleAlert, ChevronDown, ChevronUp, Camera, ScanLine,
  ThumbsUp, ThumbsDown, RotateCcw, Trash2, Download, FlipHorizontal,
} from 'lucide-react';
import jsQR from 'jsqr';
import { cn } from '@/lib/utils';
import { patrolApi, api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────
// D1 stores CURRENT_TIMESTAMP as UTC without 'Z' — append it so JS parses correctly
function parseUTC(iso: string) {
  return new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
}
function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Types ────────────────────────────────────────────────────────────────
interface Patrol {
  id: number;
  shift: 'A' | 'B' | 'C' | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  guard_name: string;
  guard_employee_id: string;
  site_name: string;
}
interface Checkpoint {
  id: number;
  name: string;
  checkpoint_code: string;
  qr_code: string;
  latitude: number;
  longitude: number;
  area_type: string;
  description: string;
}
interface PatrolCheckpoint {
  id: number;
  checkpoint_id: number;
  status: string;
  scanned_at: string | null;
  notes: string | null;
  checkpoint_name: string;
  checkpoint_code: string;
  latitude: number;
  longitude: number;
  qr_code: string;
  area_type: string;
}
interface ChecklistItem {
  id: number;
  category: string;
  item_text: string;
  is_required: number;
}

// ─── Style maps ───────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  missed:      'bg-red-100 text-red-700',
  scanned:     'bg-green-100 text-green-700',
  pending:     'bg-gray-100 text-gray-600',
  issue:       'bg-red-100 text-red-700',
};
const SHIFT_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-purple-100 text-purple-700',
};

// ─── QrCard ───────────────────────────────────────────────────────────────
function QrCard({ cp }: { cp: Checkpoint }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!cp.qr_code || !canvasRef.current) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, cp.qr_code, { width: 140, margin: 1 });
    });
  }, [cp.qr_code]);
  return (
    <div className="border border-border rounded-xl p-3 text-center hover:shadow-md transition-shadow">
      <div className="flex justify-center mb-2">
        <canvas ref={canvasRef} className="rounded" />
      </div>
      <p className="text-xs font-bold text-primary">{cp.name}</p>
      <p className="text-xs text-text-muted font-mono mt-0.5">{cp.qr_code}</p>
      <p className="text-xs text-text-muted mt-0.5">{cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}</p>
    </div>
  );
}

// ─── Download patrol detail as text ───────────────────────────────────────
function downloadPatrolDetail(patrol: Patrol, checkpoints: PatrolCheckpoint[]) {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════');
  lines.push('         SENTINEL — PATROL DETAIL REPORT');
  lines.push('═══════════════════════════════════════════════');
  lines.push(`Patrol ID   : #${patrol.id}`);
  lines.push(`Guard       : ${patrol.guard_name} (${patrol.guard_employee_id})`);
  lines.push(`Site        : ${patrol.site_name}`);
  lines.push(`Shift       : ${patrol.shift || '—'}`);
  lines.push(`Status      : ${patrol.status.toUpperCase()}`);
  lines.push(`Scheduled   : ${fmtDateTime(patrol.scheduled_start)} → ${fmtDateTime(patrol.scheduled_end)}`);
  lines.push(`Started     : ${fmtDateTime(patrol.actual_start)}`);
  lines.push(`Completed   : ${fmtDateTime(patrol.actual_end)}`);
  if (patrol.notes) lines.push(`Notes       : ${patrol.notes}`);
  lines.push('');
  lines.push('─── CHECKPOINTS ───────────────────────────────');
  const scanned = checkpoints.filter(c => c.status === 'scanned');
  lines.push(`Progress    : ${scanned.length} / ${checkpoints.length} scanned`);
  lines.push('');
  checkpoints.forEach((cp, i) => {
    const tick = cp.status === 'scanned' ? '✓' : '✗';
    lines.push(`${tick}  ${i + 1}. [${cp.checkpoint_code}] ${cp.checkpoint_name}`);
    lines.push(`      Area: ${cp.area_type || '—'}`);
    lines.push(`      Status: ${cp.status}`);
    if (cp.scanned_at) lines.push(`      Scanned: ${fmtDateTime(cp.scanned_at)}`);
    if (cp.notes) lines.push(`      Note: ${cp.notes}`);
    lines.push('');
  });
  lines.push('═══════════════════════════════════════════════');
  lines.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
  lines.push('SENTINEL Security Patrol Compliance System');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Patrol_${patrol.id}_${patrol.guard_employee_id}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function Patrols() {
  const { user, isRole } = useAuth();

  const [patrols, setPatrols]   = useState<Patrol[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');
  const [toastType, setToastType] = useState<'ok'|'err'>('ok');

  // Start patrol modal
  const [showStart, setShowStart]   = useState(false);
  const [startShift, setStartShift] = useState<'A'|'B'|'C'>('A');
  const [starting, setStarting]     = useState(false);

  // Patrol detail panel
  const [activePatrol, setActivePatrol]           = useState<Patrol | null>(null);
  const [patrolCheckpoints, setPatrolCheckpoints] = useState<PatrolCheckpoint[]>([]);
  const [loadingDetail, setLoadingDetail]         = useState(false);

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting]               = useState(false);

  // Scan wizard
  const [scanModal, setScanModal]       = useState<PatrolCheckpoint | null>(null);
  const [scanStep, setScanStep]         = useState<'gps'|'qr'|'checklist'|'photo'|'review'>('gps');
  const [gpsState, setGpsState]         = useState<'idle'|'checking'|'ok'|'far'|'error'>('idle');
  const [gpsCoords, setGpsCoords]       = useState<{lat:number;lon:number}|null>(null);
  const [gpsDistance, setGpsDistance]   = useState<number|null>(null);
  const [scanNote, setScanNote]         = useState('');
  const [scanIncident, setScanIncident] = useState('');
  const [showIncident, setShowIncident] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // QR scanning
  const [qrError, setQrError]   = useState('');
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrRafRef    = useRef<number | null>(null);

  // Checklist
  const [checklistItems, setChecklistItems]     = useState<ChecklistItem[]>([]);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, 'ok'|'issue'>>({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  // Photo
  const photoVideoRef  = useRef<HTMLVideoElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const [photoDataUrl, setPhotoDataUrl]     = useState<string | null>(null);
  const [photoBlob, setPhotoBlob]           = useState<Blob | null>(null);
  const [photoError, setPhotoError]         = useState('');
  // front / rear camera toggle
  const [facingMode, setFacingMode]         = useState<'environment'|'user'>('environment');

  // QR codes page
  const [allCheckpoints, setAllCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingQR, setLoadingQR]           = useState(false);
  const [showQRPage, setShowQRPage]         = useState(false);

  // Complete patrol
  const [completeNote, setCompleteNote] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [completing, setCompleting]     = useState(false);

  const isGuard      = isRole('security_guard');
  const isSupervisor = isRole('security_supervisor');
  const isManager    = isRole('system_admin', 'security_manager');

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true); setError('');
    patrolApi.list()
      .then((d: any) => setPatrols(d.patrols || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, type: 'ok'|'err' = 'ok') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  }

  // ── Patrol detail ────────────────────────────────────────────────────────
  async function openPatrolDetail(p: Patrol) {
    setActivePatrol(p); setLoadingDetail(true);
    try {
      const d: any = await patrolApi.get(p.id);
      setPatrolCheckpoints(d.checkpoints || []);
    } catch { showToast('Failed to load patrol detail', 'err'); }
    finally { setLoadingDetail(false); }
  }

  // ── Delete with instant UI feedback ─────────────────────────────────────
  async function handleDelete(id: number) {
    setDeleting(true);
    // 1. Immediately remove from UI list (optimistic)
    setPatrols(prev => prev.filter(p => p.id !== id));
    // 2. If it's the open patrol, close it
    if (activePatrol?.id === id) {
      setActivePatrol(null);
      setPatrolCheckpoints([]);
    }
    setDeleteConfirmId(null);
    try {
      await patrolApi.delete(id);
      showToast(`Patrol #${id} deleted`);
    } catch (e: any) {
      // Rollback on failure
      showToast(`Delete failed: ${e.message}`, 'err');
      load(); // reload to restore
    } finally {
      setDeleting(false);
    }
  }

  // ── Start patrol ─────────────────────────────────────────────────────────
  async function handleStartPatrol() {
    setStarting(true);
    try {
      const now = new Date();
      const shiftEnd = new Date(now);
      if (startShift === 'A') shiftEnd.setHours(14, 0, 0, 0);
      else if (startShift === 'B') shiftEnd.setHours(22, 0, 0, 0);
      else { shiftEnd.setHours(6, 0, 0, 0); shiftEnd.setDate(shiftEnd.getDate() + 1); }
      const d: any = await (api.post as any)('/patrols', {
        shift: startShift, site_id: 1, guard_id: user?.id,
        scheduled_start: now.toISOString(), scheduled_end: shiftEnd.toISOString(),
      });
      const patrolId = d.patrol?.id;
      if (patrolId) {
        await (api.post as any)(`/patrols/${patrolId}/start`, {});
        const started: any = await patrolApi.get(patrolId);
        setShowStart(false);
        showToast('Patrol started!');
        load();
        setActivePatrol(started.patrol);
        setPatrolCheckpoints(started.checkpoints || []);
      }
    } catch (e: any) { showToast(`Error: ${e.message}`, 'err'); }
    finally { setStarting(false); }
  }

  // ── Open scan modal ───────────────────────────────────────────────────────
  function openScanModal(cp: PatrolCheckpoint) {
    setScanModal(cp); setScanStep('gps');
    setScanNote(''); setScanIncident(''); setShowIncident(false);
    setGpsState('checking'); setGpsCoords(null); setGpsDistance(null);
    setQrError('');
    setChecklistItems([]); setChecklistAnswers({});
    setPhotoDataUrl(null); setPhotoBlob(null); setPhotoError('');
    setFacingMode('environment');
    // Start GPS immediately
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        setGpsCoords({ lat, lon });
        const dist = distanceM(lat, lon, cp.latitude, cp.longitude);
        setGpsDistance(Math.round(dist));
        setGpsState(dist <= 20 ? 'ok' : 'far'); // 150m threshold (generous for mobile GPS drift)
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function closeScanModal() {
    stopQrCamera(); stopPhotoCamera();
    setScanModal(null);
  }

  // ── QR camera ────────────────────────────────────────────────────────────
  async function startQrCamera() {
    setQrError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      qrStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        qrRafRef.current = requestAnimationFrame(scanQrFrame);
      }
    } catch {
      setQrError('Camera permission denied. Please allow camera access and try again.');
    }
  }

  function stopQrCamera() {
    if (qrRafRef.current) cancelAnimationFrame(qrRafRef.current);
    qrStreamRef.current?.getTracks().forEach(t => t.stop());
    qrStreamRef.current = null;
  }

  function scanQrFrame() {
    const video = videoRef.current;
    const canvas = qrCanvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      qrRafRef.current = requestAnimationFrame(scanQrFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      onQrDetected(code.data);
    } else {
      qrRafRef.current = requestAnimationFrame(scanQrFrame);
    }
  }

  async function onQrDetected(scannedCode: string) {
    stopQrCamera();
    if (!scanModal) return;
    if (scannedCode !== scanModal.qr_code) {
      setQrError(`Wrong QR — expected "${scanModal.qr_code}" but got "${scannedCode}". Try again.`);
      return;
    }
    setQrError('');
    // ── Load checklist for this checkpoint ──
    await loadChecklist(scanModal.qr_code);
    setScanStep('checklist');
  }

  // Separate function so it can also be called when manually bypassing QR
  async function loadChecklist(qrCode: string) {
    setLoadingChecklist(true);
    try {
      const d: any = await patrolApi.qrLookup(qrCode);
      const items: ChecklistItem[] = d.checkpoint?.checklist_items || [];
      setChecklistItems(items);
    } catch {
      setChecklistItems([]);
    } finally {
      setLoadingChecklist(false);
    }
  }

  function retryGps() {
    if (!scanModal) return;
    setGpsState('checking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        setGpsCoords({ lat, lon });
        const dist = distanceM(lat, lon, scanModal.latitude, scanModal.longitude);
        setGpsDistance(Math.round(dist));
        setGpsState(dist <= 20 ? 'ok' : 'far');
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  // ── Photo camera ─────────────────────────────────────────────────────────
  async function startPhotoCamera(facing: 'environment'|'user' = facingMode) {
    setPhotoError(''); setPhotoDataUrl(null); setPhotoBlob(null);
    // Stop any existing stream first
    stopPhotoCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 }, height: { ideal: 720 }
        }
      });
      photoStreamRef.current = stream;
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;
        await photoVideoRef.current.play();
      }
    } catch (err) {
      setPhotoError('Camera permission denied. Please allow camera access.');
    }
  }

  function stopPhotoCamera() {
    photoStreamRef.current?.getTracks().forEach(t => t.stop());
    photoStreamRef.current = null;
    if (photoVideoRef.current) photoVideoRef.current.srcObject = null;
  }

  async function flipCamera() {
    const next: 'environment'|'user' = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startPhotoCamera(next);
  }

  function capturePhoto() {
    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    if (!video || !canvas) { setPhotoError('Camera not ready. Please open camera first.'); return; }
    if (video.readyState < video.HAVE_ENOUGH_DATA) { setPhotoError('Camera still loading, please wait…'); return; }

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Timestamp + checkpoint name overlay
    const now = new Date();
    const ts = now.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const label = `${scanModal?.checkpoint_name || ''} · ${ts}`;
    const fontSize = Math.max(16, Math.round(canvas.width / 45));
    ctx.font = `bold ${fontSize}px monospace`;
    const w = ctx.measureText(label).width;
    const pad = 10, bx = pad, by = canvas.height - fontSize - pad * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 4, by - 4, w + 16, fontSize + 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, bx + 4, by + fontSize);

    canvas.toBlob(blob => {
      if (!blob) { setPhotoError('Failed to capture image. Please try again.'); return; }
      setPhotoBlob(blob);
      setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
      stopPhotoCamera();
    }, 'image/jpeg', 0.85);
  }

  function retakePhoto() {
    setPhotoDataUrl(null); setPhotoBlob(null);
    startPhotoCamera(facingMode);
  }

  // ── Submit scan ───────────────────────────────────────────────────────────
  async function submitScan() {
    if (!scanModal || !activePatrol) return;
    if (!photoBlob) { showToast('Photo is required before submitting', 'err'); return; }
    setSubmitting(true);
    try {
      setUploadingPhoto(true);
      const photoResult = await patrolApi.uploadPhoto(activePatrol.id, scanModal.checkpoint_id, photoBlob);
      setUploadingPhoto(false);

      const checklist_responses = checklistItems.map(item => ({
        checklist_item_id: item.id,
        response: checklistAnswers[item.id] || 'na',
        notes: null,
      }));

      const combinedNotes = [scanNote, scanIncident ? `Incident: ${scanIncident}` : null]
        .filter(Boolean).join(' | ') || null;

      await (api.post as any)(`/patrols/${activePatrol.id}/scan`, {
        checkpoint_id: scanModal.checkpoint_id,
        notes: combinedNotes,
        latitude: gpsCoords?.lat,
        longitude: gpsCoords?.lon,
        photo_url: photoResult.photo_url,
        checklist_responses,
      });

      closeScanModal();
      showToast(`✓ ${scanModal.checkpoint_name} marked as visited`);
      const d: any = await patrolApi.get(activePatrol.id);
      setPatrolCheckpoints(d.checkpoints || []);
    } catch (e: any) {
      showToast(`Error: ${e.message}`, 'err');
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  }

  // ── Complete patrol ───────────────────────────────────────────────────────
  async function handleComplete() {
    if (!activePatrol) return;
    setCompleting(true);
    try {
      await patrolApi.complete(activePatrol.id);
      // Update list in-place
      setPatrols(prev => prev.map(p => p.id === activePatrol.id ? { ...p, status: 'completed' } : p));
      setShowComplete(false); setActivePatrol(null); setPatrolCheckpoints([]);
      showToast('Patrol completed successfully!');
    } catch (e: any) { showToast(`Error: ${e.message}`, 'err'); }
    finally { setCompleting(false); }
  }

  // ── QR codes page ─────────────────────────────────────────────────────────
  async function openQRPage() {
    setShowQRPage(true); setLoadingQR(true);
    try {
      const d: any = await (api.get as any)('/sites/1/checkpoints');
      setAllCheckpoints(d.checkpoints || []);
    } catch { showToast('Failed to load checkpoints', 'err'); }
    finally { setLoadingQR(false); }
  }

  const myActivePatrol = patrols.find(p =>
    p.status === 'in_progress' && p.guard_employee_id === user?.employee_id
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm shadow-xl',
          toastType === 'err' ? 'bg-red-600' : 'bg-primary'
        )}>
          {toast}
          <button onClick={() => setToast('')}><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Patrols</h2>
          <p className="text-text-muted text-sm">Security patrol operations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-surface-alt transition-colors text-text-muted">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isManager && (
            <button onClick={openQRPage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-alt transition-colors">
              <QrCode size={16} /> QR Codes
            </button>
          )}
          {(isGuard || isSupervisor) && !myActivePatrol && (
            <button onClick={() => setShowStart(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
              <Play size={16} /> Start Patrol
            </button>
          )}
          {(isGuard || isSupervisor) && myActivePatrol && (
            <button onClick={() => openPatrolDetail(myActivePatrol)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">
              <ShieldCheck size={16} /> Active Patrol
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Patrol list */}
      {loading && patrols.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {patrols.map(p => (
            <div key={p.id}
              className={cn('bg-white rounded-xl border p-4 hover:shadow-md transition-shadow',
                p.status === 'in_progress' ? 'border-amber-300' : 'border-border'
              )}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Main info — clickable */}
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => openPatrolDetail(p)}>
                  <div className={cn('p-2 rounded-lg shrink-0', p.status === 'in_progress' ? 'bg-amber-100 text-amber-600' : 'bg-accent/10 text-accent')}>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      Patrol #{p.id} — {p.guard_name}
                      <span className="text-text-muted font-normal ml-1">({p.guard_employee_id})</span>
                    </p>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {p.site_name}
                      <span className="mx-1">·</span>
                      <Clock size={11} /> {fmtDate(p.scheduled_start)} {fmtTime(p.actual_start || p.scheduled_start)}
                    </p>
                  </div>
                </div>

                {/* Badges + actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {p.shift && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', SHIFT_COLOR[p.shift])}>
                      Shift {p.shift}
                    </span>
                  )}
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_COLOR[p.status])}>
                    {p.status.replace('_', ' ')}
                  </span>

                  {/* Download button — visible to managers/admins */}
                  {isManager && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Load checkpoints if needed
                        try {
                          const d: any = await patrolApi.get(p.id);
                          downloadPatrolDetail(p, d.checkpoints || []);
                        } catch { showToast('Failed to fetch patrol data', 'err'); }
                      }}
                      title="Download patrol report"
                      className="p-1.5 rounded-lg border border-border hover:bg-blue-50 hover:border-blue-300 text-text-muted hover:text-blue-600 transition-colors"
                    >
                      <Download size={14} />
                    </button>
                  )}

                  {/* Delete button — admins only, only non-active patrols */}
                  {isManager && p.status !== 'in_progress' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                      title="Delete patrol"
                      className="p-1.5 rounded-lg border border-border hover:bg-red-50 hover:border-red-300 text-text-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {patrols.length === 0 && (
            <div className="text-center text-text-muted py-16">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No patrols yet</p>
              {(isGuard || isSupervisor) && <p className="text-sm mt-1">Click "Start Patrol" to begin</p>}
            </div>
          )}
        </div>
      )}

      {/* ── DELETE CONFIRM DIALOG ──────────────────────────────────────── */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="font-semibold text-primary mb-1">Delete Patrol #{deleteConfirmId}?</h3>
            <p className="text-sm text-text-muted mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId!)}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── START PATROL MODAL ────────────────────────────────────────── */}
      {showStart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                <Play size={16} /> Start New Patrol
              </h3>
              <button onClick={() => setShowStart(false)} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-2">Select Your Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A', 'B', 'C'] as const).map(s => (
                    <button key={s} onClick={() => setStartShift(s)}
                      className={cn('py-3 rounded-xl border-2 text-sm font-bold transition-all',
                        startShift === s
                          ? s === 'A' ? 'border-green-500 bg-green-50 text-green-700'
                            : s === 'B' ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-border text-text-muted hover:border-accent/40'
                      )}>
                      Shift {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {startShift === 'A' ? '06:00 – 14:00' : startShift === 'B' ? '14:00 – 22:00' : '22:00 – 06:00'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">📍 Site: HPCL Visakh Refinery</p>
                <p className="text-xs text-blue-600 mt-1">Date & Time: {new Date().toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowStart(false)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
              <button onClick={handleStartPatrol} disabled={starting}
                className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PATROL DETAIL MODAL ──────────────────────────────────────── */}
      {activePatrol && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                  <ShieldCheck size={16} /> Patrol #{activePatrol.id}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {activePatrol.guard_name} · {fmtDate(activePatrol.actual_start || activePatrol.scheduled_start)}
                  {activePatrol.shift && ` · Shift ${activePatrol.shift}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_COLOR[activePatrol.status])}>
                  {activePatrol.status.replace('_', ' ')}
                </span>
                {/* Download from detail modal */}
                {isManager && (
                  <button
                    onClick={() => downloadPatrolDetail(activePatrol, patrolCheckpoints)}
                    title="Download report"
                    className="p-1.5 rounded-md border border-border hover:bg-blue-50 text-text-muted hover:text-blue-600 transition-colors">
                    <Download size={15} />
                  </button>
                )}
                <button onClick={() => { setActivePatrol(null); setPatrolCheckpoints([]); }}
                  className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16} /></button>
              </div>
            </div>

            {patrolCheckpoints.length > 0 && (
              <div className="px-5 pt-3">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Progress</span>
                  <span>{patrolCheckpoints.filter(c => c.status === 'scanned').length}/{patrolCheckpoints.length} checkpoints</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all rounded-full"
                    style={{ width: `${(patrolCheckpoints.filter(c => c.status === 'scanned').length / patrolCheckpoints.length) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-text-muted gap-2">
                  <Loader2 size={18} className="animate-spin" /> Loading checkpoints…
                </div>
              ) : patrolCheckpoints.map(cp => (
                <div key={cp.id}
                  className={cn('flex items-center justify-between p-3 rounded-xl border transition-all',
                    cp.status === 'scanned' ? 'bg-green-50 border-green-200' : 'bg-white border-border'
                  )}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                      cp.status === 'scanned' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500')}>
                      {cp.status === 'scanned' ? <CheckCircle2 size={16} /> : cp.checkpoint_code?.slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">{cp.checkpoint_name}</p>
                      <p className="text-xs text-text-muted">{cp.checkpoint_code}
                        {cp.scanned_at && ` · ${fmtTime(cp.scanned_at)}`}
                      </p>
                    </div>
                  </div>
                  {activePatrol.status === 'in_progress' && cp.status !== 'scanned' && (
                    <button onClick={() => openScanModal(cp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors">
                      <QrCode size={12} /> Scan
                    </button>
                  )}
                  {cp.status === 'scanned' && <CheckCircle2 size={18} className="text-green-500 shrink-0" />}
                </div>
              ))}
            </div>

            {activePatrol.status === 'in_progress' && (
              <div className="p-5 border-t border-border">
                <button onClick={() => setShowComplete(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
                  <CheckSquare size={16} /> Complete Patrol
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCAN WIZARD MODAL ──────────────────────────────────────────── */}
      {scanModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
                  {scanStep === 'gps'       ? 'Step 1 / 5 · Verify Location' :
                   scanStep === 'qr'        ? 'Step 2 / 5 · Scan QR Code' :
                   scanStep === 'checklist' ? 'Step 3 / 5 · Checklist' :
                   scanStep === 'photo'     ? 'Step 4 / 5 · Capture Photo' :
                   'Step 5 / 5 · Review & Submit'}
                </p>
                <h3 className="text-sm font-semibold text-primary">{scanModal.checkpoint_name}</h3>
              </div>
              <button onClick={closeScanModal} className="p-1.5 rounded-lg hover:bg-surface-alt text-text-muted"><X size={16} /></button>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 px-4 py-2 shrink-0">
              {(['gps', 'qr', 'checklist', 'photo', 'review'] as const).map((s, i) => (
                <div key={s} className={cn('h-1 rounded-full flex-1 transition-all',
                  s === scanStep ? 'bg-accent' :
                  ['gps', 'qr', 'checklist', 'photo', 'review'].indexOf(scanStep) > i ? 'bg-green-400' : 'bg-gray-200'
                )} />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ── STEP 1: GPS ─────────────────────────────────────── */}
              {scanStep === 'gps' && (
                <div className="p-4 space-y-3">
                  <div className={cn('p-5 rounded-xl border-2 text-center',
                    gpsState === 'checking' ? 'border-blue-200 bg-blue-50' :
                    gpsState === 'ok'       ? 'border-green-300 bg-green-50' :
                    gpsState === 'far'      ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
                  )}>
                    {gpsState === 'checking' && (
                      <><Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-500" />
                        <p className="text-sm font-medium text-blue-700">Getting your location…</p></>
                    )}
                    {gpsState === 'ok' && (
                      <><CheckCircle2 size={36} className="mx-auto mb-2 text-green-500" />
                        <p className="text-sm font-bold text-green-700">✓ Location Verified</p>
                        <p className="text-xs text-green-600 mt-1">You are {gpsDistance}m from the checkpoint</p></>
                    )}
                    {gpsState === 'far' && (
                      <><Navigation size={32} className="mx-auto mb-2 text-red-500" />
                        <p className="text-sm font-bold text-red-700">Too Far Away</p>
                        <p className="text-xs text-red-600 mt-1">You are {gpsDistance}m away. Must be within 20m.</p>
                        {gpsCoords && <p className="text-xs text-red-400 mt-1 font-mono">{gpsCoords.lat.toFixed(5)}, {gpsCoords.lon.toFixed(5)}</p>}
                        <button onClick={retryGps} className="mt-3 text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg">Retry GPS</button></>
                    )}
                    {gpsState === 'error' && (
                      <><AlertCircle size={32} className="mx-auto mb-2 text-orange-500" />
                        <p className="text-sm font-bold text-orange-700">GPS Error</p>
                        <p className="text-xs text-orange-600 mt-1">Enable location access and retry.</p>
                        <button onClick={retryGps} className="mt-3 text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg">Retry</button></>
                    )}
                  </div>
                  {gpsState === 'ok' && (
                    <button onClick={() => setScanStep('qr')}
                      className="w-full py-3 bg-accent text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <QrCode size={15} /> Next: Scan QR Code →
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP 2: QR SCAN ─────────────────────────────────── */}
              {scanStep === 'qr' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-text-muted text-center">Point at the QR code on the checkpoint board.</p>
                  <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                    <canvas ref={qrCanvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-44 h-44 border-2 border-white/70 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent rounded-tl-md" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent rounded-tr-md" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent rounded-bl-md" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent rounded-br-md" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 inset-x-0 flex justify-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                        <ScanLine size={11} /> Scanning…
                      </span>
                    </div>
                  </div>
                  {qrError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-center">{qrError}</div>
                  )}
                  {!qrStreamRef.current && (
                    <button onClick={startQrCamera}
                      className="w-full py-3 bg-accent text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <Camera size={16} /> Open Camera
                    </button>
                  )}
                  {qrError && (
                    <button onClick={() => { setQrError(''); startQrCamera(); }}
                      className="w-full py-2.5 border border-border rounded-xl text-sm text-text-muted hover:bg-surface-alt">
                      Try Again
                    </button>
                  )}
                  {/* Dev/fallback: skip QR and load checklist from code */}
                  <button
                    onClick={async () => {
                      stopQrCamera();
                      await loadChecklist(scanModal.qr_code);
                      setScanStep('checklist');
                    }}
                    className="w-full py-2 text-xs text-text-muted border border-dashed border-border rounded-xl hover:bg-surface-alt">
                    Skip QR Scan (manual entry)
                  </button>
                </div>
              )}

              {/* ── STEP 3: CHECKLIST ───────────────────────────────── */}
              {scanStep === 'checklist' && (
                <div className="p-4 space-y-2">
                  {loadingChecklist ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-text-muted">
                      <Loader2 size={18} className="animate-spin" /> Loading checklist…
                    </div>
                  ) : checklistItems.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 size={28} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-text-muted">No checklist items for this checkpoint.</p>
                      <p className="text-xs text-text-muted mt-1">Proceed to photo capture.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-text-muted mb-3">
                        Mark each item <span className="text-green-600 font-semibold">OK</span> or <span className="text-red-600 font-semibold">Issue</span>.
                        Required items are marked with *.
                      </p>
                      {['Security', 'Safety', 'Fire', 'Environmental', 'Housekeeping'].map(cat => {
                        const items = checklistItems.filter(i => i.category === cat);
                        if (!items.length) return null;
                        return (
                          <div key={cat} className="mb-4">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                              {cat}
                            </p>
                            {items.map(item => (
                              <div key={item.id}
                                className={cn('flex items-center justify-between p-3 rounded-xl border mb-2 transition-colors',
                                  checklistAnswers[item.id] === 'ok'    ? 'bg-green-50 border-green-200' :
                                  checklistAnswers[item.id] === 'issue' ? 'bg-red-50 border-red-200' :
                                  'bg-white border-border'
                                )}>
                                <p className="text-xs text-primary flex-1 pr-3">
                                  {item.item_text}
                                  {item.is_required ? <span className="text-red-500 ml-0.5">*</span> : null}
                                </p>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => setChecklistAnswers(a => ({ ...a, [item.id]: 'ok' }))}
                                    className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                      checklistAnswers[item.id] === 'ok'
                                        ? 'bg-green-500 text-white border-green-500'
                                        : 'border-gray-200 text-gray-500 hover:bg-green-50 hover:border-green-300'
                                    )}>
                                    <ThumbsUp size={11} /> OK
                                  </button>
                                  <button
                                    onClick={() => setChecklistAnswers(a => ({ ...a, [item.id]: 'issue' }))}
                                    className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                      checklistAnswers[item.id] === 'issue'
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-300'
                                    )}>
                                    <ThumbsDown size={11} /> Issue
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {/* Summary bar */}
                      <div className="flex gap-4 text-xs p-3 bg-gray-50 rounded-xl border border-border">
                        <span className="text-green-600 font-semibold">✓ {Object.values(checklistAnswers).filter(v => v === 'ok').length} OK</span>
                        <span className="text-red-600 font-semibold">⚠ {Object.values(checklistAnswers).filter(v => v === 'issue').length} Issues</span>
                        <span className="text-gray-400">{checklistItems.length - Object.keys(checklistAnswers).length} pending</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 4: PHOTO ───────────────────────────────────── */}
              {scanStep === 'photo' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-text-muted text-center">
                    Take a <strong>live photo</strong> of the checkpoint. Gallery uploads are not allowed.
                  </p>
                  {!photoDataUrl ? (
                    <>
                      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        <video ref={photoVideoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                        <canvas ref={photoCanvasRef} className="hidden" />
                        {!photoStreamRef.current && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <Camera size={40} className="text-white/40" />
                            <span className="text-white/50 text-xs">Camera not started</span>
                          </div>
                        )}
                        {/* Timestamp overlay preview */}
                        {photoStreamRef.current && (
                          <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                            <span className="bg-black/60 text-white font-mono text-xs px-2 py-0.5 rounded">
                              {scanModal.checkpoint_name} · {new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                        {/* Camera flip button — top right */}
                        {photoStreamRef.current && (
                          <button
                            onClick={flipCamera}
                            title="Switch camera"
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors">
                            <FlipHorizontal size={18} />
                          </button>
                        )}
                      </div>
                      {photoError && (
                        <p className="text-xs text-red-600 text-center bg-red-50 border border-red-200 rounded-lg p-2">{photoError}</p>
                      )}
                      {!photoStreamRef.current ? (
                        <button onClick={() => startPhotoCamera(facingMode)}
                          className="w-full py-3 bg-accent text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                          <Camera size={16} /> Open Camera
                        </button>
                      ) : (
                        <button
                          onClick={capturePhoto}
                          className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                          <Camera size={16} /> Capture Photo
                        </button>
                      )}
                      <p className="text-center text-xs text-text-muted">
                        {facingMode === 'environment' ? '📷 Rear camera' : '🤳 Front camera'} ·
                        Tap <FlipHorizontal size={11} className="inline" /> to switch
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl overflow-hidden border border-border">
                        <img src={photoDataUrl} alt="Captured" className="w-full object-cover" />
                      </div>
                      <p className="text-xs text-green-600 text-center font-semibold">✓ Photo captured with timestamp</p>
                      <button onClick={retakePhoto}
                        className="w-full py-2.5 border border-border rounded-xl text-sm text-text-muted hover:bg-surface-alt flex items-center justify-center gap-2">
                        <RotateCcw size={14} /> Retake Photo
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 5: REVIEW & SUBMIT ─────────────────────────── */}
              {scanStep === 'review' && (
                <div className="p-4 space-y-3">
                  {photoDataUrl && (
                    <div className="rounded-xl overflow-hidden border border-border h-32">
                      <img src={photoDataUrl} alt="Photo" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 rounded-xl border border-border">
                    <p className="text-xs font-semibold text-text-muted mb-1.5">Checklist Summary</p>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600 font-semibold">✓ {Object.values(checklistAnswers).filter(v => v === 'ok').length} OK</span>
                      <span className="text-red-600 font-semibold">⚠ {Object.values(checklistAnswers).filter(v => v === 'issue').length} Issues</span>
                      <span className="text-gray-400">{checklistItems.length - Object.keys(checklistAnswers).length} unanswered</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1 flex items-center gap-1">
                      <FileText size={11} /> Observation Note <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea value={scanNote} onChange={e => setScanNote(e.target.value)}
                      rows={2} placeholder="Everything normal / any observation…"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
                  </div>
                  <div>
                    <button onClick={() => setShowIncident(v => !v)}
                      className="flex items-center gap-2 text-xs font-medium text-red-600 hover:text-red-700">
                      <TriangleAlert size={12} />
                      {showIncident ? 'Hide' : 'Report an Incident'} (optional)
                      {showIncident ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    {showIncident && (
                      <textarea value={scanIncident} onChange={e => setScanIncident(e.target.value)}
                        rows={2} placeholder="Describe the incident…"
                        className="mt-2 w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 resize-none" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border shrink-0 flex gap-2">
              <button onClick={closeScanModal}
                className="flex-none px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">
                Cancel
              </button>

              {scanStep === 'checklist' && (
                <button
                  onClick={() => {
                    const required = checklistItems.filter(i => i.is_required);
                    const unanswered = required.filter(i => !checklistAnswers[i.id]);
                    if (unanswered.length > 0) {
                      showToast(`Answer all ${unanswered.length} required items first`, 'err');
                      return;
                    }
                    setScanStep('photo');
                    // Auto-start camera when entering photo step
                    setTimeout(() => startPhotoCamera(facingMode), 100);
                  }}
                  className="flex-1 py-2.5 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                  Next: Photo →
                </button>
              )}

              {scanStep === 'photo' && photoDataUrl && (
                <button onClick={() => setScanStep('review')}
                  className="flex-1 py-2.5 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                  Next: Review →
                </button>
              )}

              {scanStep === 'review' && (
                <button onClick={submitScan} disabled={submitting || !photoBlob}
                  className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-medium">
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> {uploadingPhoto ? 'Uploading photo…' : 'Submitting…'}</>
                    : <><CheckCircle2 size={14} /> Mark Visited</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLETE PATROL MODAL ────────────────────────────────────── */}
      {showComplete && activePatrol && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <CheckSquare size={16} /> Complete Patrol
            </h3>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
              <p className="text-xs text-amber-700">
                {patrolCheckpoints.filter(c => c.status === 'scanned').length} of {patrolCheckpoints.length} checkpoints visited.
                {patrolCheckpoints.some(c => c.status !== 'scanned') && ' Some checkpoints are still pending.'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">
                Summary Note <span className="text-gray-400">(optional)</span>
              </label>
              <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)}
                rows={3} placeholder="Overall patrol summary…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowComplete(false)}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
              <button onClick={handleComplete} disabled={completing}
                className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR CODES PAGE ────────────────────────────────────────────── */}
      {showQRPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                <QrCode size={16} /> Checkpoint QR Codes
              </h3>
              <button onClick={() => setShowQRPage(false)} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingQR ? (
                <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
                  <Loader2 size={18} className="animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-4">Print and place at each checkpoint. Guards scan when within 20m.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {allCheckpoints.map(cp => <QrCard key={cp.id} cp={cp} />)}
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-border">
              <button onClick={() => window.print()}
                className="w-full py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
                🖨️ Print All QR Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
