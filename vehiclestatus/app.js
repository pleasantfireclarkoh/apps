(() => {
  'use strict';
  // Match the six IDs used by the department admin form. Positions stay fixed.
  const roster = [
    { unit: 'ENGINE 1-75', name: 'ENGINE 1', suffix: '-75', vehicle: 'engine' },
    { unit: 'ENGINE 2-75', name: 'ENGINE 2', suffix: '-75', vehicle: 'engine' },
    { unit: 'MEDIC 75', name: 'MEDIC', suffix: ' 75', vehicle: 'medic' },
    { unit: 'TANKER 75', name: 'TANKER', suffix: ' 75', vehicle: 'tanker' },
    { unit: 'BRUSH 75', name: 'BRUSH', suffix: ' 75', vehicle: 'brush' },
    { unit: 'AIR 75', name: 'AIR', suffix: ' 75', vehicle: 'air' }
  ];
  const $ = id => document.getElementById(id);
  const demo = new URLSearchParams(window.location.search).get('demo') === '1';
  let reports = new Map();
  let feedState = 'connecting';
  let unsubscribe = null;
  let retryTimer = null;
  let connecting = false;
  let rotatingFields = [];

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function asDate(value) {
    if (value == null || value === '') return null;
    try { const date = value.toDate ? value.toDate() : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
    catch { return null; }
  }
  function relativeTime(value) {
    const date = asDate(value);
    if (!date) return 'No report received';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Updated just now';
    if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `Updated ${Math.floor(seconds / 86400)}d ago`;
    return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  function statusInfo(value) {
    switch (String(value || '').trim().toLowerCase()) {
      case 'in service': return { theme: 'service', label: 'In service', icon: 'check' };
      case 'limited service': return { theme: 'limited', label: 'Limited service', icon: 'alert' };
      case 'oos': case 'out of service': return { theme: 'oos', label: 'Out of service', icon: 'cross' };
      default: return { theme: 'unknown', label: value ? `Unknown · ${value}` : 'Unreported', icon: 'radio' };
    }
  }
  const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;

  function render() {
    $('unit-grid').innerHTML = roster.map((unit, index) => {
      const report = reports.get(unit.unit) || {};
      const status = statusInfo(report.status);
      const stale = !demo && feedState !== 'live' && reports.has(unit.unit);
      return `<article class="unit-card ${status.theme}" aria-label="${escapeHTML(unit.unit)}, ${escapeHTML(status.label)}" data-unit="${unit.unit}" data-stale="${stale}">
        <div class="card-status">${icon(status.icon)}<span>${escapeHTML(status.label)}${demo ? ' · Demo' : stale ? ' · Last known' : ''}</span><span class="card-index">${String(index + 1).padStart(2, '0')} / 06</span></div>
        <div class="card-body">
          <div class="unit-identity"><h3 class="unit-name" aria-label="${unit.unit}">${unit.name}<span class="unit-station">${unit.suffix}</span></h3><svg class="vehicle-drawing" viewBox="0 0 240 100" aria-hidden="true"><use href="#vehicle-${unit.vehicle}"/></svg></div>
          <div class="unit-location">${icon('pin')}<span data-rotate-text data-field="Location">${escapeHTML(report.location || 'Location not reported')}</span></div>
          <div class="unit-remarks"><span class="label">REMARKS</span><p data-rotate-text data-field="Remarks" class="${report.comments ? '' : 'empty'}">${escapeHTML(report.comments || (reports.has(unit.unit) ? 'No active remarks.' : 'Awaiting a status report.'))}</p></div>
        </div>
        <div class="card-footer"><span class="report-time">${icon('clock')}<span data-report-time="${unit.unit}">${relativeTime(report.reported)}</span></span><span class="rotation-indicator"></span></div>
      </article>`;
    }).join('');
    prepareTextPages();
  }
  function setFeed(state) {
    feedState = state;
    render();
  }
  function updateReportTimes() {
    document.querySelectorAll('[data-report-time]').forEach(element => { element.textContent = relativeTime(reports.get(element.dataset.reportTime)?.reported); });
  }
  // Fit long reports into readable pages so every word is shown without input.
  function prepareTextPages() {
    rotatingFields = [];
    document.querySelectorAll('[data-rotate-text]').forEach(element => {
      const fullText = element.dataset.fullText ?? element.textContent;
      element.dataset.fullText = fullText;
      let remaining = fullText;
      const pages = [];
      if (element.clientHeight === 0 || element.clientWidth === 0) return;
      while (remaining) {
        element.textContent = remaining;
        if (element.scrollHeight <= element.clientHeight + 1) { pages.push(remaining); break; }
        const characters = Array.from(remaining);
        let low = 1, high = characters.length, fit = 1;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          element.textContent = characters.slice(0, middle).join('');
          if (element.scrollHeight <= element.clientHeight + 1) { fit = middle; low = middle + 1; }
          else high = middle - 1;
        }
        const candidate = characters.slice(0, fit).join('');
        const wordBoundary = candidate.search(/\s+\S*$/u);
        const end = wordBoundary > candidate.length / 2 ? wordBoundary : candidate.length;
        pages.push(remaining.slice(0, end).trimEnd());
        remaining = remaining.slice(end).trimStart();
      }
      element.textContent = pages[0] || fullText;
      if (pages.length > 1) rotatingFields.push({ element, pages, index: 0 });
    });
    updatePageIndicators();
  }
  function updatePageIndicators() {
    document.querySelectorAll('.unit-card').forEach(card => {
      card.querySelector('.rotation-indicator').textContent = rotatingFields
        .filter(field => card.contains(field.element))
        .map(field => `${field.element.dataset.field} ${field.index + 1}/${field.pages.length}`)
        .join(' · ');
    });
  }
  setInterval(() => {
    rotatingFields.forEach(field => {
      field.index = (field.index + 1) % field.pages.length;
      field.element.textContent = field.pages[field.index];
    });
    updatePageIndicators();
  }, 12000);
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(prepareTextPages, 150); });
  if (document.fonts) document.fonts.ready.then(prepareTextPages);

  async function connect() {
    if (demo || connecting) return;
    connecting = true;
    clearTimeout(retryTimer);
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    setFeed(navigator.onLine ? 'connecting' : 'offline');
    try {
      const [{ initializeApp, getApps }, { getAuth, signInAnonymously, signInWithCustomToken }, { getFirestore, collection, onSnapshot }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]);
      const firebaseConfig = {
        apiKey: 'AIzaSyBsaM_8RjTsgaSOPrOkyaK1DXghCHumxkc',
        authDomain: 'pleasant-fire.firebaseapp.com',
        projectId: 'pleasant-fire',
        storageBucket: 'pleasant-fire.firebasestorage.app',
        messagingSenderId: '107375626982',
        appId: '1:107375626982:web:97eed5f81377b15eba8927',
        measurementId: 'G-TT4G7K37M2'
      };
      const app = getApps()[0] || initializeApp(firebaseConfig);
      const auth = getAuth(app);
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'pleasant-township-app';
      const ref = collection(getFirestore(app), 'artifacts', appId, 'public', 'data', 'unitStatus');
      unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
        reports = new Map(snapshot.docs.map(doc => { const data = doc.data(); return [String(data.unit || doc.id).trim().toUpperCase(), data]; }));
        if (!snapshot.metadata.fromCache && navigator.onLine) { setFeed('live'); }
        else setFeed(navigator.onLine ? 'cached' : 'offline');
        updateReportTimes();
      }, error => { console.error('Apparatus status feed:', error); setFeed('error'); retryTimer = setTimeout(connect, 30000); });
    } catch (error) { console.error('Apparatus status connection:', error); setFeed(navigator.onLine ? 'error' : 'offline'); retryTimer = setTimeout(connect, 30000); }
    finally { connecting = false; }
  }
  window.addEventListener('offline', () => { if (!demo) setFeed('offline'); });
  window.addEventListener('online', () => { if (!demo) connect(); });
  render(); updateReportTimes(); setInterval(updateReportTimes, 1000);
  if (demo) {
    const now = Date.now();
    reports = new Map([
      ['ENGINE 1-75', { status: 'In Service', location: 'STATION 75', comments: '', reported: new Date(now - 8 * 60000) }],
      ['ENGINE 2-75', { status: 'Limited Service', location: 'STATION 75', comments: 'Foam system unavailable. Engine remains available for response. Use the portable foam equipment when required. Report any additional issues to the officer in charge. The onboard foam system must remain isolated until maintenance completes inspection and testing. A follow-up status report is required before returning the system to service.', reported: new Date(now - 24 * 60000) }],
      ['MEDIC 75', { status: 'In Service', location: 'STATION 75', comments: '', reported: new Date(now - 12 * 60000) }],
      ['TANKER 75', { status: 'In Service', location: 'STATION 75', comments: '', reported: new Date(now - 48 * 60000) }],
      ['BRUSH 75', { status: 'In Service', location: 'STATION 75', comments: '', reported: new Date(now - 92 * 60000) }],
      ['AIR 75', { status: 'OOS', location: 'MAINTENANCE', comments: 'Compressor service in progress. Do not place in service.', reported: new Date(now - 126 * 60000) }]
    ]);
    setFeed('demo'); updateReportTimes();
  } else connect();
})();
