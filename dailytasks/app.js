import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, onSnapshot, query } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const firebaseConfig = {
          apiKey: "AIzaSyBsaM_8RjTsgaSOPrOkyaK1DXghCHumxkc",
          authDomain: "pleasant-fire.firebaseapp.com",
          projectId: "pleasant-fire",
          storageBucket: "pleasant-fire.firebasestorage.app",
          messagingSenderId: "107375626982",
          appId: "1:107375626982:web:97eed5f81377b15eba8927",
          measurementId: "G-TT4G7K37M2"
        };
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const auth=getAuth(app);
let unsubscribe;

onAuthStateChanged(auth,async user=>{
  if(unsubscribe) { unsubscribe(); unsubscribe=undefined; }
  if(!user) {
    try { await signInAnonymously(auth); }
    catch(error) {
      console.error('Daily tasks sign-in failed:',error);
      window.dailyTasksBoard.setError('Unable to connect to the station schedule. Check the connection and reload.');
    }
    return;
  }
  const tasks=collection(db,'artifacts','pleasant-township-app','public','data','dailyTasks');
  unsubscribe=onSnapshot(query(tasks),{includeMetadataChanges:true},snapshot=>{
    // Wait for server confirmation before treating an empty initial cache as today's schedule.
    if(snapshot.metadata.fromCache && snapshot.empty) return;
    window.dailyTasksBoard.setTasks(snapshot.docs.map(doc=>doc.data()),snapshot.metadata.fromCache);
  },error=>{
    console.error('Daily tasks listener failed:',error);
    window.dailyTasksBoard.setError(error.code==='permission-denied'
      ? 'Access to the station schedule needs attention. Contact the dashboard administrator.'
      : 'Unable to load the station schedule. Check the connection and reload.');
  });
});
