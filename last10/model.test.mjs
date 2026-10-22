import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestRuns, presentation, dispatchParts } from './model.mjs';

test('newest year and numeric sequence first; capped at ten without mutating input', () => {
  const calls = Array.from({length:12},(_,i)=>({id:String(i),year:'2026',sequence:String(i+1)}));
  calls.push({id:'new-year',year:2027,sequence:1});
  assert.deepEqual(latestRuns(calls).map(c=>c.id),['new-year','11','10','9','8','7','6','5','4','3']);
  assert.equal(calls[0].id,'0');
});
test('legacy incident IDs and dispatch dates remain sortable', () => {
  const calls=[{id:'bad'},{id:'old',incidentNumber:'25HT00999'},{id:'date',dispatchDate:'2024-01-01'},{id:'new',incidentNumber:'26PL00001'}];
  assert.deepEqual(latestRuns(calls).map(c=>c.id),['new','old','date','bad']);
});
test('EMS masking handles whitespace, legacy codes, and explicit EMS responses', () => {
  for (const callNature of ['fall',' SICK ','RESPARR','ALRCO','OD']) assert.equal(presentation({callNature}).nature,'EMS CALL');
  assert.equal(presentation({callNature:'Custom medical detail',responseType:'ems'}).nature,'EMS CALL');
  assert.equal(presentation({callNature:'FALL',responseType:'Both'}).nature,'EMS CALL');
  assert.equal(presentation({callNature:'MVA',responseType:'Both'}).typeLabel,'Fire + EMS response');
});
test('missing data has readable fallbacks and HTML remains plain text', () => {
  assert.equal(presentation({}).address,'Address not provided');
  assert.equal(presentation({address:'<img src=x onerror=alert(1)>'}).address,'<img src=x onerror=alert(1)>');
  assert.equal(presentation({callNature:{bad:true}}).nature,'NATURE NOT PROVIDED');
});
test('date and time are validated independently, including leap years and midnight', () => {
  assert.equal(dispatchParts({dispatchDate:'2026-02-30',dispatchTime:'99:99'}).datetime,'');
  assert.equal(dispatchParts({dispatchDate:'2024-02-29',dispatchTime:'00:00'}).datetime,'2024-02-29T00:00');
  assert.equal(dispatchParts({dispatchDate:'2026-10-22'}).date,'10/22/2026');
  assert.equal(dispatchParts({dispatchTime:'14:35:59'}).time,'14:35');
  assert.equal(dispatchParts({dispatchDate:'2026-10-22',dispatchTime:'25:00'}).time,'Time unavailable');
});
