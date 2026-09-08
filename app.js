/* ============================================================
   Bronco Trailer Inspection — Rhino Energy Solutions
   Single-file app logic. No build step, no framework.
   ============================================================ */

/* ---------- Checklist definition ---------- */
const CHECKLIST = [
  { id: 's1', title: 'Documentation & Compliance', items: [
    'Registration / licence disc current',
    'Chassis / VIN plate visible & legible',
    'GVM / load rating plate',
    'Retro-reflective markings/tape (rear & sides)',
    'Number plate present & legible',
  ]},
  { id: 's2', title: 'Chassis & Deck', items: [
    'Main chassis frame (rust / cracks / bends)',
    'Cross members',
    'Deck / floor boards or steel deck surface',
    'Deck welds / joints',
    'Non-slip deck coating',
  ]},
  { id: 's3', title: 'Coupling & Towing Gear', items: [
    'Tow hitch / coupling head',
    'Coupling lock mechanism',
    'Breakaway cable (condition & attachment)',
    'Safety chains',
    'Jockey wheel',
    'Jockey wheel handle / clamp',
    'Hitch pin / lock',
  ]},
  { id: 's4', title: 'Suspension & Axles', items: [
    'Axle(s)',
    'Leaf springs / suspension units',
    'Shackles & bushes',
    'U-bolts',
    'Wheel bearings',
    'Mudguards / fenders',
  ]},
  { id: 's5', title: 'Wheels & Tyres', items: [
    'Tyres — tread & sidewalls (both sides)',
    'Wheel rims',
    'Wheel nuts / studs',
    'Spare wheel & carrier',
  ]},
  { id: 's6', title: 'Braking System', items: [
    'Handbrake / parking brake lever',
    'Handbrake cable / linkage',
    'Breakaway trip function (cable pulls handbrake on disconnection)',
  ]},
  { id: 's7', title: 'Electrical', items: [
    'Trailer plug / cable (7-pin)',
    'Tail lights',
    'Brake light — left',
    'Brake light — right',
    'Indicator — left',
    'Indicator — right',
    'Hazard lights',
    'Number plate light',
    'Side / rear reflectors',
    'Wiring loom condition',
  ]},
  { id: 's8', title: 'Loading & Securing', items: [
    'Loading ramps',
    'Ramp pins / hinges',
    'Tie-down points / D-rings',
    'Straps / chains',
    'Winch & winch cable (if fitted)',
    'Wheel chocks / stoppers',
  ]},
  { id: 's9', title: 'Bodywork & Structure', items: [
    'Side braces / rails',
    'Headboard / bulkhead',
    'Mudflaps',
    'General paint / rust condition',
  ]},
  { id: 's10', title: 'General Safety', items: [
    'Stabiliser / jack legs',
    'Fire extinguisher (if carried)',
    'Overall cleanliness / general condition',
  ]},
];

const STATUS_DEFS = [
  { key: 'good',     label: 'Good' },
  { key: 'fair',     label: 'Fair' },
  { key: 'damaged',  label: 'Damaged' },
  { key: 'unusable', label: 'Unusable' },
  { key: 'na',       label: 'N/A' },
];

/* Flat item list with stable ids: s1-0, s1-1, ... */
const ALL_ITEMS = [];
CHECKLIST.forEach(sec => sec.items.forEach((name, i) => {
  ALL_ITEMS.push({ id: `${sec.id}-${i}`, sectionId: sec.id, name });
}));

/* ---------- State ---------- */
function blankState() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const items = {};
  ALL_ITEMS.forEach(it => { items[it.id] = { status: null, note: '', photos: [] }; });
  return {
    inspector: '', date: iso, license: '', siteName: '', siteLocation: '',
    signature: null, signedAt: null,
    items,
  };
}

let state = blankState();
const uiState = { openSections: new Set(), openItems: new Set(), photoTarget: null };

/* ---------- IndexedDB draft persistence ---------- */
const DB_NAME = 'bronco-inspection-db';
const STORE = 'drafts';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveDraft() {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, 'current');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('saveDraft failed', e); }
}
async function loadDraft() {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get('current');
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { console.warn('loadDraft failed', e); return null; }
}
async function clearDraft() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete('current');
  } catch (e) { /* ignore */ }
}
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 500);
}

/* ---------- Helpers ---------- */
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function todayLabel() {
  return new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast ' + type; }, 2600);
}
function showSpinner(text) {
  document.getElementById('spinner-text').textContent = text || 'Working…';
  document.getElementById('spinner-overlay').classList.add('open');
}
function hideSpinner() { document.getElementById('spinner-overlay').classList.remove('open'); }

/* ---------- Derived / validation ---------- */
function itemNeedsPhoto(itemState) {
  return itemState.status !== 'na';
}
function computeStats() {
  const s = { good: 0, fair: 0, damaged: 0, unusable: 0, na: 0, unset: 0, total: ALL_ITEMS.length, missingPhotos: 0 };
  ALL_ITEMS.forEach(it => {
    const st = state.items[it.id];
    if (!st.status) s.unset++; else s[st.status]++;
    if (itemNeedsPhoto(st) && st.photos.length === 0) s.missingPhotos++;
  });
  return s;
}
function metaComplete() {
  return state.inspector.trim() && state.date && state.license.trim() && state.siteName.trim() && state.siteLocation.trim();
}
function updateValidationUI() {
  const stats = computeStats();
  const line = document.getElementById('validation-line');
  const btn = document.getElementById('export-btn');
  const problems = [];
  if (!metaComplete()) problems.push('inspection details incomplete');
  if (stats.unset > 0) problems.push(`${stats.unset} item${stats.unset===1?'':'s'} not checked`);
  if (stats.missingPhotos > 0) problems.push(`${stats.missingPhotos} photo${stats.missingPhotos===1?'':'s'} missing`);
  if (!state.signature) problems.push('signature missing');

  if (problems.length) {
    line.textContent = 'Before you can export: ' + problems.join(', ');
    line.classList.remove('ok');
    btn.disabled = true;
  } else {
    line.textContent = 'Ready to export ✓';
    line.classList.add('ok');
    btn.disabled = false;
  }
  // header today
  const h = document.getElementById('hdr-today');
  if (h) h.textContent = todayLabel();
}

/* ---------- Rendering ---------- */
function statusBadgeForSection(sec) {
  let done = 0, issues = 0;
  sec.items.forEach((_, i) => {
    const st = state.items[`${sec.id}-${i}`];
    if (st.status) done++;
    if (st.status === 'damaged' || st.status === 'unusable') issues++;
  });
  const total = sec.items.length;
  if (issues > 0) return `<span class="section-badge has-issues">${issues} issue${issues===1?'':'s'}</span>`;
  if (done === total) return `<span class="section-badge done">${done}/${total}</span>`;
  return `<span class="section-badge">${done}/${total}</span>`;
}

function renderApp() {
  const stats = computeStats();
  const body = document.getElementById('app-body');

  const draftBanner = uiState.showDraftBanner
    ? `<div class="draft-banner">
         <span>A saved draft was found on this device.</span>
         <button class="btn secondary" style="width:auto" onclick="dismissDraftBanner()">Got it</button>
       </div>`
    : '';

  const metaHtml = `
    <div class="meta-card">
      <div class="meta-title">Inspection Details</div>
      <div class="meta-grid">
        <div class="meta-field full">
          <label>Inspector Name</label>
          <input type="text" value="${esc(state.inspector)}" placeholder="Enter your name"
                 oninput="onMetaInput('inspector', this.value)">
        </div>
        <div class="meta-field">
          <label>Date</label>
          <input type="date" value="${esc(state.date)}" oninput="onMetaInput('date', this.value)">
        </div>
        <div class="meta-field">
          <label>Trailer License No.</label>
          <input type="text" value="${esc(state.license)}" placeholder="e.g. NW 123 456"
                 oninput="onMetaInput('license', this.value)">
        </div>
        <div class="meta-field">
          <label>Site Name</label>
          <input type="text" value="${esc(state.siteName)}" placeholder="e.g. Richards Bay Yard"
                 oninput="onMetaInput('siteName', this.value)">
        </div>
        <div class="meta-field">
          <label>Site Location</label>
          <input type="text" value="${esc(state.siteLocation)}" placeholder="e.g. KwaZulu-Natal"
                 oninput="onMetaInput('siteLocation', this.value)">
        </div>
      </div>
    </div>`;

  const statsHtml = `
    <div class="stats">
      <div class="stat"><div class="stat-label">Good</div><div class="stat-val good">${stats.good}</div></div>
      <div class="stat"><div class="stat-label">Fair</div><div class="stat-val fair">${stats.fair}</div></div>
      <div class="stat"><div class="stat-label">Issues</div><div class="stat-val issue">${stats.damaged + stats.unusable}</div></div>
      <div class="stat"><div class="stat-label">Checked</div><div class="stat-val tot">${stats.total - stats.unset}/${stats.total}</div></div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.round((stats.total-stats.unset)/stats.total*100)}%"></div></div>
  `;

  const sectionsHtml = CHECKLIST.map(sec => {
    const open = uiState.openSections.has(sec.id);
    const itemsHtml = sec.items.map((name, i) => renderItem(sec, i, name)).join('');
    return `
      <div class="section-block">
        <div class="section-hdr" onclick="toggleSection('${sec.id}')">
          <span class="section-num">${sec.id.replace('s','')}</span>
          <span class="section-hdr-title">${esc(sec.title)}</span>
          ${statusBadgeForSection(sec)}
          <span class="section-chevron ${open?'open':''}">&#9660;</span>
        </div>
        <div class="section-items ${open?'open':''}">${itemsHtml}</div>
      </div>`;
  }).join('');

  body.innerHTML = draftBanner + metaHtml + statsHtml +
    `<div class="section-label"><span>Checklist — ${CHECKLIST.length} Sections, ${ALL_ITEMS.length} Items</span></div>` +
    sectionsHtml;

  const signCardHtml = `
    <div class="sign-card" id="sign-card">
      <div class="meta-title">Inspector Signature</div>
      <div class="sign-pad-wrap" id="sign-pad-wrap">
        <canvas id="sign-canvas"></canvas>
        <div class="sign-hint ${state.signature?'hidden':''}" id="sign-hint">Sign with your finger</div>
      </div>
      <div class="sign-foot">
        <div class="sign-name">${state.signature ? `Signed by <b>${esc(state.inspector||'Inspector')}</b>` : 'Not signed yet'}</div>
        <button class="sign-clear" onclick="clearSignature()">Clear</button>
      </div>
    </div>`;
  body.insertAdjacentHTML('beforeend', signCardHtml);
  body.insertAdjacentHTML('beforeend', '<div class="credit-line">Created by David J Wilson — Rhino Energy Solutions</div>');

  initSignaturePad();
  updateValidationUI();
}

function renderItem(sec, index, name) {
  const id = `${sec.id}-${index}`;
  const st = state.items[id];
  const open = uiState.openItems.has(id);
  const needsPhoto = itemNeedsPhoto(st);
  const photoOk = !needsPhoto || st.photos.length > 0;
  const issue = st.status === 'damaged' || st.status === 'unusable';

  const statusButtons = STATUS_DEFS.map(sd =>
    `<div class="s-btn ${sd.key} ${st.status===sd.key?'active':''}" onclick="setStatus('${id}','${sd.key}')">${sd.label}</div>`
  ).join('');

  const photosHtml = st.photos.map((p, pi) =>
    `<img class="item-photo-thumb" src="${p.dataUrl}" onclick="openPhotoViewer('${id}',${pi})" alt="Photo ${pi+1}">`
  ).join('') +
  `<div class="add-photo-btn ${needsPhoto && st.photos.length===0 ? 'required':''}" onclick="openPhotoSheet('${id}')">
     <span style="font-size:18px;line-height:1">+</span><span style="font-size:9px">add photo</span>
   </div>`;

  return `
    <div class="item-card ${issue?'issue':''} ${!photoOk?'missing-photo':''}">
      <div class="item-hdr" onclick="toggleItem('${id}')">
        <span class="item-num">${sec.id.replace('s','')}.${index+1}</span>
        <span class="item-name">${esc(name)}</span>
        ${!photoOk ? '<span class="item-photo-flag" title="Photo required">&#128247;</span>' : ''}
        <span class="item-status-dot ${st.status||''}"></span>
        <span class="item-chevron ${open?'open':''}">&#9660;</span>
      </div>
      <div class="item-body ${open?'open':''}">
        <div class="status-label">Condition</div>
        <div class="status-row">${statusButtons}</div>

        <label class="note-label">Description</label>
        <textarea class="note-input" placeholder="Add description if required…"
                  oninput="onNoteInput('${id}', this.value)">${esc(st.note)}</textarea>

        <div class="photo-label">Photo
          <span class="req-tag ${photoOk?'met':''}">${needsPhoto ? (photoOk?'Attached':'Required') : 'Not required'}</span>
        </div>
        <div class="photo-strip">${photosHtml}</div>
      </div>
    </div>`;
}

/* ---------- Interaction handlers ---------- */
function onMetaInput(field, value) {
  state[field] = value;
  updateValidationUI();
  scheduleSave();
}
function onNoteInput(itemId, value) {
  state.items[itemId].note = value;
  scheduleSave();
}
function toggleSection(id) {
  if (uiState.openSections.has(id)) uiState.openSections.delete(id);
  else uiState.openSections.add(id);
  renderApp();
}
function toggleItem(id) {
  if (uiState.openItems.has(id)) uiState.openItems.delete(id);
  else uiState.openItems.add(id);
  renderApp();
}
function setStatus(itemId, status) {
  const st = state.items[itemId];
  st.status = st.status === status ? null : status;
  uiState.openItems.add(itemId);
  renderApp();
  scheduleSave();
}
function dismissDraftBanner() {
  uiState.showDraftBanner = false;
  renderApp();
}

/* ---------- Photo capture ---------- */
function openPhotoSheet(itemId) {
  uiState.photoTarget = itemId;
  const item = ALL_ITEMS.find(i => i.id === itemId);
  document.getElementById('sheet-sub').textContent = item ? item.name : '';
  document.getElementById('sheet-backdrop').classList.add('open');
  document.getElementById('photo-sheet').classList.add('open');
}
function closePhotoSheet() {
  document.getElementById('sheet-backdrop').classList.remove('open');
  document.getElementById('photo-sheet').classList.remove('open');
}
function triggerCamera() { closePhotoSheet(); document.getElementById('photo-input-camera').click(); }
function triggerLibrary() { closePhotoSheet(); document.getElementById('photo-input-library').click(); }

async function compressImageFile(file, maxDim = 1100, quality = 0.65) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    bitmap = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = bitmap.width, h0 = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

async function handlePhotoFile(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  if (!file || !uiState.photoTarget) return;
  const itemId = uiState.photoTarget;
  try {
    showSpinner('Processing photo…');
    const dataUrl = await compressImageFile(file);
    state.items[itemId].photos.push({ id: 'p' + Date.now() + Math.random().toString(36).slice(2,6), dataUrl });
    uiState.openItems.add(itemId);
    renderApp();
    scheduleSave();
  } catch (e) {
    console.error(e);
    toast('Could not process that photo', 'error');
  } finally {
    hideSpinner();
  }
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('photo-input-camera').addEventListener('change', e => handlePhotoFile(e.target));
  document.getElementById('photo-input-library').addEventListener('change', e => handlePhotoFile(e.target));
});

/* ---------- Photo viewer ---------- */
function openPhotoViewer(itemId, photoIndex) {
  const st = state.items[itemId];
  const photo = st.photos[photoIndex];
  if (!photo) return;
  const item = ALL_ITEMS.find(i => i.id === itemId);
  const total = st.photos.length;
  document.getElementById('photo-modal-content').innerHTML = `
    <div class="modal-title">${esc(item ? item.name : '')}</div>
    <div class="modal-sub">Photo ${photoIndex+1} of ${total}</div>
    <img class="photo-frame" src="${photo.dataUrl}" alt="Photo">
    <div class="modal-actions">
      <div class="m-btn approve" onclick="closePhotoViewer()">&#10003; Approve</div>
      <div class="m-btn remove" onclick="removePhoto('${itemId}',${photoIndex})">&#128465; Remove</div>
    </div>
    <div class="modal-close" onclick="closePhotoViewer()">Close</div>
  `;
  document.getElementById('photo-modal-bg').classList.add('open');
}
function closePhotoViewer() {
  document.getElementById('photo-modal-bg').classList.remove('open');
}
function removePhoto(itemId, photoIndex) {
  state.items[itemId].photos.splice(photoIndex, 1);
  closePhotoViewer();
  renderApp();
  scheduleSave();
}

/* ---------- Signature pad ---------- */
let signCtx = null, signing = false, signHasStroke = false;
function initSignaturePad() {
  const canvas = document.getElementById('sign-canvas');
  const wrap = document.getElementById('sign-pad-wrap');
  if (!canvas || !wrap) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  signCtx = canvas.getContext('2d');
  signCtx.scale(dpr, dpr);
  signCtx.lineWidth = 2.4;
  signCtx.lineCap = 'round';
  signCtx.lineJoin = 'round';
  signCtx.strokeStyle = '#2a2a2b';

  if (state.signature) {
    const img = new Image();
    img.onload = () => signCtx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = state.signature;
    signHasStroke = true;
  } else {
    signHasStroke = false;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) {
    e.preventDefault();
    signing = true;
    document.getElementById('sign-hint').classList.add('hidden');
    const p = pos(e);
    signCtx.beginPath();
    signCtx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!signing) return;
    e.preventDefault();
    const p = pos(e);
    signCtx.lineTo(p.x, p.y);
    signCtx.stroke();
    signHasStroke = true;
  }
  function end() {
    if (!signing) return;
    signing = false;
    commitSignature();
  }
  canvas.onpointerdown = start;
  canvas.onpointermove = move;
  window.addEventListener('pointerup', end);
  canvas.ontouchstart = start;
  canvas.ontouchmove = move;
  canvas.ontouchend = end;
}
function commitSignature() {
  const canvas = document.getElementById('sign-canvas');
  if (!canvas || !signHasStroke) return;
  state.signature = canvas.toDataURL('image/png');
  state.signedAt = new Date().toISOString();
  updateValidationUI();
  scheduleSave();
  const nameEl = document.querySelector('.sign-name');
  if (nameEl) nameEl.innerHTML = `Signed by <b>${esc(state.inspector||'Inspector')}</b>`;
}
function clearSignature() {
  state.signature = null;
  state.signedAt = null;
  signHasStroke = false;
  renderApp();
  scheduleSave();
}

/* ---------- New inspection ---------- */
function confirmNewInspection() {
  if (confirm('Start a new inspection? This clears the current form on this device.')) {
    state = blankState();
    uiState.openSections.clear();
    uiState.openItems.clear();
    uiState.showDraftBanner = false;
    clearDraft();
    renderApp();
    window.scrollTo(0, 0);
    toast('Started a new inspection');
  }
}

/* ---------- PDF export ---------- */
async function loadImageAsDataUrl(path) {
  const res = await fetch(path);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function statusColor(status) {
  switch (status) {
    case 'good': return [76, 175, 120];
    case 'fair': return [173, 140, 0];
    case 'damaged': return [200, 60, 60];
    case 'unusable': return [139, 0, 0];
    case 'na': return [120, 161, 187];
    default: return [150, 150, 150];
  }
}
function statusText(status) {
  const d = STATUS_DEFS.find(s => s.key === status);
  return d ? d.label : 'Not checked';
}

async function buildPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  let logoDataUrl = null;
  try { logoDataUrl = await loadImageAsDataUrl('icons/icon-192.png'); } catch (e) { /* ok without */ }

  function newPage() {
    doc.addPage();
    y = margin;
    drawRunningHeader();
  }
  function ensure(h) {
    if (y + h > pageH - margin) newPage();
  }
  function drawRunningHeader() {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Bronco Trailer Inspection — ${state.license || ''}`, margin, 20);
    doc.text(`${state.date}`, pageW - margin, 20, { align: 'right' });
    doc.setDrawColor(220); doc.line(margin, 26, pageW - margin, 26);
  }

  /* Title block */
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', margin, y, 34, 34); } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text('Bronco Trailer Inspection', margin + 44, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Rhino Energy Solutions', margin + 44, y + 30);
  y += 52;

  doc.setDrawColor(230);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  /* Details grid */
  const details = [
    ['Inspector', state.inspector || '—'],
    ['Date', state.date || '—'],
    ['Trailer License No.', state.license || '—'],
    ['Site Name', state.siteName || '—'],
    ['Site Location', state.siteLocation || '—'],
  ];
  doc.setFontSize(10);
  details.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = margin + col * ((pageW - margin*2) / 2);
    const yy = y + row * 30;
    doc.setTextColor(150);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(k.toUpperCase(), x, yy);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(String(v), x, yy + 13);
  });
  y += Math.ceil(details.length/2) * 30 + 14;

  /* Summary */
  const stats = computeStats();
  doc.setFillColor(245, 245, 243);
  doc.roundedRect(margin, y, pageW - margin*2, 34, 4, 4, 'F');
  const summaryItems = [
    ['Good', stats.good, [76,175,120]],
    ['Fair', stats.fair, [173,140,0]],
    ['Issues', stats.damaged + stats.unusable, [200,60,60]],
    ['N/A', stats.na, [120,161,187]],
    ['Total', stats.total, [60,60,60]],
  ];
  const cw = (pageW - margin*2) / summaryItems.length;
  summaryItems.forEach(([label, val, color], i) => {
    const cx = margin + i*cw + cw/2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(String(val), cx, y + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(label.toUpperCase(), cx, y + 26, { align: 'center' });
  });
  y += 34 + 20;

  /* Sections */
  for (const sec of CHECKLIST) {
    ensure(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(40);
    doc.text(sec.title, margin, y);
    y += 8;
    doc.setDrawColor(210);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    for (let i = 0; i < sec.items.length; i++) {
      const id = `${sec.id}-${i}`;
      const name = sec.items[i];
      const st = state.items[id];
      const noteLines = st.note ? doc.splitTextToSize(st.note, pageW - margin*2 - 14) : [];
      const photoRows = Math.ceil((st.photos.length || 0) / 4);
      const blockH = 20 + (noteLines.length * 11) + (photoRows > 0 ? photoRows * 70 + 6 : 0) + 10;
      ensure(blockH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30);
      doc.text(`${sec.id.replace('s','')}.${i+1}  ${name}`, margin, y);

      const color = statusColor(st.status);
      const label = statusText(st.status);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const labelW = doc.getTextWidth(label) + 10;
      doc.setFillColor(...color);
      doc.roundedRect(pageW - margin - labelW, y - 10, labelW, 14, 3, 3, 'F');
      doc.setTextColor(255);
      doc.text(label, pageW - margin - labelW/2, y - 0.5, { align: 'center' });
      y += 14;

      if (noteLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(noteLines, margin + 10, y);
        y += noteLines.length * 11 + 2;
      }

      if (st.photos.length) {
        let px = margin + 10;
        const pw = 66, ph = 50, gap = 8;
        st.photos.forEach((p, pi) => {
          if (pi > 0 && pi % 4 === 0) { y += ph + 8; px = margin + 10; }
          try { doc.addImage(p.dataUrl, 'JPEG', px, y, pw, ph); } catch (e) {}
          doc.setDrawColor(210);
          doc.rect(px, y, pw, ph);
          px += pw + gap;
        });
        y += ph + 10;
      } else {
        y += 4;
      }
      y += 6;
    }
    y += 6;
  }

  /* Signature */
  ensure(120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(40);
  doc.text('Inspector Sign-Off', margin, y);
  y += 14;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  if (state.signature) {
    try { doc.addImage(state.signature, 'PNG', margin, y, 180, 70); } catch (e) {}
  }
  doc.setDrawColor(200);
  doc.line(margin, y + 78, margin + 220, y + 78);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${state.inspector || ''}  —  ${state.date || ''}`, margin, y + 90);

  return doc;
}

async function onExportClick() {
  if (document.getElementById('export-btn').disabled) {
    toast('Please complete the checklist and signature first', 'error');
    return;
  }
  try {
    showSpinner('Generating PDF…');
    const doc = await buildPdf();
    const filenameSafe = (state.license || 'trailer').replace(/[^a-z0-9]+/gi, '-');
    const filename = `Bronco-Inspection-${filenameSafe}-${state.date}.pdf`;
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    hideSpinner();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Bronco Trailer Inspection',
          text: `Bronco trailer inspection — ${state.license || ''} — ${state.date}`,
        });
        toast('Shared ✓', 'success');
        return;
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') return; // user cancelled share sheet
        console.warn('share failed, falling back to download', shareErr);
      }
    }
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('PDF downloaded — attach it to WhatsApp or email manually', 'success');
  } catch (e) {
    console.error(e);
    hideSpinner();
    toast('Could not generate the PDF', 'error');
  }
}

/* ---------- Startup ---------- */
async function start() {
  document.getElementById('hdr-today').textContent = todayLabel();
  const draft = await loadDraft();
  if (draft && draft.items) {
    state = draft;
    // backfill any new checklist items not present in an older saved draft
    ALL_ITEMS.forEach(it => { if (!state.items[it.id]) state.items[it.id] = { status: null, note: '', photos: [] }; });
    uiState.showDraftBanner = true;
  }
  renderApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed', err));
  }
}
start();
