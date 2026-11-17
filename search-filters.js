/* W1.3B.2 — Filtres opcionals; no alteren les metadades ni els PDF. */
export const blankAdvancedFilters=()=>({composer:'',type:'',yearFrom:'',yearTo:''});
export const cleanSearchText=value=>String(value??'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export function countAdvancedFilters(filters={}){
 return ['composer','type','yearFrom','yearTo'].filter(key=>String(filters?.[key]??'').trim()!=='').length;
}
export function matchesScoreSearch(score,query='',filters={}){
 if(!score)return false;
 const meta=score.metadata||{};
 const text=cleanSearchText((score.path||'')+' '+(meta.title||''));
 if(!text.includes(cleanSearchText(query)))return false;
 for(const field of ['composer','type']){
  const need=cleanSearchText(filters[field]);
  if(need&&!cleanSearchText(meta[field]).includes(need))return false;
 }
 const year=String(meta.year||'');
 const from=String(filters.yearFrom||'').trim(),to=String(filters.yearTo||'').trim();
 if(from||to){
  if(!/^\d{4}$/.test(year))return false;
  if(from&&(!/^\d{4}$/.test(from)||Number(year)<Number(from)))return false;
  if(to&&(!/^\d{4}$/.test(to)||Number(year)>Number(to)))return false;
 }
 return true;
}
