/* W1.3B.1 — Metadades opcionals, independents del contingut PDF. */
export const SCORE_METADATA_FIELDS=Object.freeze({title:140,composer:140,type:80,year:4,notes:1200});
export function normalizeScoreMetadata(input){
 if(input===undefined||input===null)return {};
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Les metadades no són vàlides.');
 const allowed=Object.keys(SCORE_METADATA_FIELDS);
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Les metadades contenen camps desconeguts.');
 const output={};
 for(const key of allowed){
  const raw=input[key];
  if(raw===undefined||raw===null||raw==='')continue;
  if(typeof raw!=='string')throw new Error('El camp '+key+' ha de ser text.');
  const value=key==='notes'?raw.replace(/\r\n?/g,'\n').trim():raw.trim().replace(/\s+/g,' ');
  if(!value)continue;
  if(value.length>SCORE_METADATA_FIELDS[key])throw new Error('El camp '+key+' és massa llarg.');
  if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value))throw new Error('Les metadades contenen caràcters no admesos.');
  if(key==='year'&&!/^\d{4}$/.test(value))throw new Error('L’any ha de tindre quatre xifres.');
  output[key]=value;
 }
 return output;
}
export function hasScoreMetadata(score){return !!score?.metadata&&Object.keys(score.metadata).some(k=>!!score.metadata[k]);}
export function scoreDisplayTitle(score){return score?.metadata?.title?.trim()||(score?.path||'').split('/').at(-1)?.replace(/\.pdf$/i,'')||'';}
