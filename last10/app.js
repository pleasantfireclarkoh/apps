import { latestRuns, presentation, dispatchParts } from './model.mjs';

const ui = Object.fromEntries(['notice','notice-text','retry','empty-state','loading-state','loading-detail','runs-list','feed-announcement','incident-template'].map(id => [id,document.getElementById(id)]));
let unsubscribe, sdk, auth, db, connecting = false, failed = false, receivedSnapshot = false, serverConfirmed = false, loadingTimer;
let rendered = '', cacheOnly = true, slowConnection = false;
const cards = new Map();
function status(state) { document.querySelector('.board').dataset.connection = state; }
function notice(message,retry = false) { ui.notice.hidden = !message; ui['notice-text'].textContent = message; ui.retry.hidden = !retry; }
function syncStatus() {
  if (!navigator.onLine) {
    cacheOnly = true; serverConfirmed = false;
    status('offline');
    notice(receivedSnapshot ? 'Connection lost. Displaying the last received incidents; updates will resume when connected.' : 'You are offline. The incident feed will connect when a connection is available.',failed);
  } else if (failed) status('error');
  else if (receivedSnapshot && !cacheOnly && serverConfirmed) { status('live'); notice(''); }
  else if (receivedSnapshot) { status('cached'); notice('Displaying the last received incidents. Waiting for the live feed to reconnect.',slowConnection); }
  else {
    status('connecting');
    if (slowConnection) notice('The live feed is taking longer than expected to connect. Check your connection or try again.',true);
  }
}

function render(data) {
  const fingerprint = JSON.stringify(data.map(run => [run.id,presentation(run),dispatchParts(run)]));
  if (fingerprint === rendered) return;
  rendered = fingerprint;
  const keep = new Set();
  data.forEach((run,index) => {
    const key = run.id; keep.add(key);
    let card = cards.get(key);
    if (!card) { card = ui['incident-template'].content.firstElementChild.cloneNode(true); cards.set(key,card); }
    const item = presentation(run), dispatch = dispatchParts(run);
    card.dataset.type = item.type;
    card.querySelector('.run-number').textContent = item.number;
    card.querySelector('.nature').textContent = item.nature;
    card.querySelector('.latest-tag').hidden = index !== 0;
    card.querySelector('.address span').textContent = item.address;
    card.querySelector('.incident-type').textContent = item.typeLabel;
    const time = card.querySelector('time');
    if (dispatch.datetime) time.setAttribute('datetime',dispatch.datetime); else time.removeAttribute('datetime');
    const dateSpan = document.createElement('span'), timeSpan = document.createElement('span');
    dateSpan.textContent = dispatch.date; timeSpan.textContent = dispatch.time; timeSpan.className = 'time';
    time.replaceChildren(dateSpan,timeSpan);
    // Ordinary snapshots keep existing cards, avoiding repeated entrance animations.
    if (ui['runs-list'].children[index] !== card) ui['runs-list'].insertBefore(card,ui['runs-list'].children[index] || null);
  });
  for (const [key,card] of cards) if (!keep.has(key)) { card.remove(); cards.delete(key); }
  ui['loading-state'].hidden = true;
  ui['empty-state'].hidden = !!data.length;
  ui['runs-list'].hidden = !data.length;
  ui['feed-announcement'].textContent = data.length ? `${data.length} recent incidents. Latest incident ${presentation(data[0]).number}.` : 'No incidents recorded.';
}

function connectionError(error) {
  console.error('Incident feed connection failed:',error);
  clearTimeout(loadingTimer); connecting = false; failed = true;
  ui['loading-state'].hidden = true;
  const denied = error?.code === 'permission-denied' || error?.code === 'auth/operation-not-allowed';
  notice(denied ? 'The incident feed is unavailable for this connection. Check access settings, then retry.' : receivedSnapshot ? 'Live updates are interrupted. Displaying the last received incidents.' : 'Could not connect to the incident feed. Check your connection and retry.',true);
  syncStatus();
}

async function connect() {
  if (connecting) return;
  connecting = true; failed = false; cacheOnly = true; serverConfirmed = false; slowConnection = false;
  unsubscribe?.(); unsubscribe = undefined;
  notice(''); syncStatus();
  if (!receivedSnapshot) { ui['loading-state'].hidden = false; ui['loading-detail'].textContent = 'The latest calls will appear here automatically.'; }
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    if (!serverConfirmed && !failed) { slowConnection = true; syncStatus(); }
  },15000);
  try {
    if (!sdk) {
      const [appModule,authModule,storeModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]);
      const app = appModule.initializeApp({apiKey:'AIzaSyBsaM_8RjTsgaSOPrOkyaK1DXghCHumxkc',authDomain:'pleasant-fire.firebaseapp.com',projectId:'pleasant-fire',storageBucket:'pleasant-fire.firebasestorage.app',messagingSenderId:'107375626982',appId:'1:107375626982:web:97eed5f81377b15eba8927',measurementId:'G-TT4G7K37M2'});
      auth = authModule.getAuth(app); db = storeModule.getFirestore(app);
      sdk = {...authModule,...storeModule};
    }
    if (!auth.currentUser) {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await sdk.signInWithCustomToken(auth,__initial_auth_token);
      else await sdk.signInAnonymously(auth);
    }
    // Server-side orderBy would silently exclude legacy records with missing sort fields.
    unsubscribe = sdk.onSnapshot(sdk.collection(db,'artifacts','pleasant-township-app','public','data','calls'),{includeMetadataChanges:true},snapshot => {
      failed = false; cacheOnly = snapshot.metadata.fromCache;
      if (!cacheOnly) { serverConfirmed = true; slowConnection = false; clearTimeout(loadingTimer); }
      const calls = snapshot.docs.map(doc => ({...doc.data(),id:doc.id}));
      // An unconfirmed empty cache does not establish an empty database.
      if (!cacheOnly || calls.length) { receivedSnapshot = true; render(latestRuns(calls)); }
      syncStatus();
    },connectionError);
    connecting = false;
  } catch(error) { connectionError(error); }
}

ui.retry.addEventListener('click',() => { if (connecting) location.reload(); else connect(); });
window.addEventListener('offline',syncStatus);
window.addEventListener('online',() => { if (failed || !unsubscribe) connect(); else syncStatus(); });
document.addEventListener('visibilitychange',() => { if (!document.hidden) { syncStatus(); if (failed && navigator.onLine) connect(); } });
window.addEventListener('pagehide',() => { unsubscribe?.(); unsubscribe = undefined; });
window.addEventListener('pageshow',event => { if (event.persisted) connect(); });
setInterval(syncStatus,60000);
syncStatus(); connect();
