// Preserve nature-code masking, including older records without a response type.
const EMS_NATURES = new Set(['FALL','SICK','RESP','BACK','PERUNCON','ABDOM','CARDIAC','BLEEDING','SEIZURE','STROKE','TRAUMA','DEATH','EXPOSURE','ALRMED','CHESPAIN','ALRCO','DIABETIC','HEADACHE','OD','SUICTHRT','EDP','ASSAULT','SUICIDE','DISORD','ALLERGIC','DVA','WEAPON','RESPARR']);
export const text = value => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
export function presentation(run) {
  const nature = text(run.callNature).toUpperCase(), response = text(run.responseType).toUpperCase();
  const isEMS = EMS_NATURES.has(nature) || response === 'EMS';
  const type = response === 'BOTH' ? 'both' : isEMS ? 'ems' : response === 'FIRE' ? 'fire' : 'other';
  return { nature:isEMS ? 'EMS CALL' : nature || 'NATURE NOT PROVIDED', type,
    typeLabel:{both:'Fire + EMS response',ems:'EMS response',fire:'Fire response',other:'Incident'}[type],
    number:text(run.incidentNumber) || 'Not assigned',address:text(run.address) || 'Address not provided' };
}
export function dispatchParts(run) {
  const date = text(run.dispatchDate), time = text(run.dispatchTime), match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  let validDate = false;
  if (match) {
    const parsed = new Date(`${date}T12:00:00`);
    validDate = !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === +match[1] && parsed.getMonth()+1 === +match[2] && parsed.getDate() === +match[3];
  }
  const validTime = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time);
  return {date:validDate ? `${match[2]}/${match[3]}/${match[1]}` : 'Date unavailable',time:validTime ? time.slice(0,5) : 'Time unavailable',datetime:validDate ? date + (validTime ? `T${time}` : '') : ''};
}
function orderKey(run) {
  const incident = /^(\d{2})(?:PL|HT)(\d+)$/i.exec(text(run.incidentNumber));
  const numeric = value => text(value) !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const dateYear = /^(\d{4})-/.exec(text(run.dispatchDate));
  return [numeric(run.year) ?? (incident ? 2000 + +incident[1] : dateYear ? +dateYear[1] : 0),numeric(run.sequence) ?? (incident ? +incident[2] : 0),dispatchParts(run).datetime];
}
export function latestRuns(calls) {
  return [...calls].sort((a,b) => {const aa=orderKey(a),bb=orderKey(b);return bb[0]-aa[0] || bb[1]-aa[1] || bb[2].localeCompare(aa[2]) || text(a.id).localeCompare(text(b.id));}).slice(0,10);
}
