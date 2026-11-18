/* W2.19 · Edició avançada. Conserva el motor PDF i els formats W2.18. */
import {ScoreViewer as BaseViewer} from './viewer-w218.js';
import {normalizeAnnotations} from './annotations.js';
import {translatedStroke,objectBounds} from './annotation-geometry.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>structuredClone(value);
const levels=[0,.15,.35,.60,1];
const historyCap=24;

export class ScoreViewer extends BaseViewer{
 constructor(options){
  super(options);
  this.annotationRedoHistory=new Map();
  this.annotationClipboardCut=false;
  this.annotationClipboardIndex=null;
  this.shapeFillOpacity=0;
 }
 selectedAnnotationObject(){
  return this.hasSelectedAnnotation()?this.annotationsOnPage()[this.selectedAnnotation]:null;
 }
 selectedCanFill(){return ['rectangle','ellipse'].includes(this.selectedAnnotationObject()?.tool);}
 setShapeFillOpacity(value){
  const next=Number(value);
  if(!levels.includes(next))return false;
  this.shapeFillOpacity=next;this.notify();return true;
 }
 fillSelectedShape(value){
  if(!this.annotationMode||!this.selectedCanFill()||this.inlineSession)return false;
  const opacity=Number(value),index=this.selectedAnnotation,old=this.selectedAnnotationObject();
  if(!levels.includes(opacity))return false;
  if((old.fillOpacity??0)===opacity)return true;
  if(!this.commitAnnotationPage(this.annotationsOnPage().map((item,i)=>
      i===index?{...item,fillOpacity:opacity}:item)))return false;
  this.selectedAnnotation=index;this.shapeFillOpacity=opacity;this.redrawAnnotations();this.notify();
  return true;
 }
 // La geometria del PDF original i les anotacions continua sent única.
 redrawAnnotations(){
  super.redrawAnnotations();
  const all=this.annotationsOnPage();
  for(const path of this.annotationSvg?.querySelectorAll('path.annotation-stroke')||[]){
   const stroke=all[Number(path.dataset.annotationIndex)];
   if(!['rectangle','ellipse'].includes(stroke?.tool))continue;
   path.setAttribute('fill',stroke.color);
   path.setAttribute('fill-opacity',String(stroke.fillOpacity??0));
  }
 }
 annotationPointerDown(event){
  super.annotationPointerDown(event);
  if(['rectangle','ellipse'].includes(this.activeAnnotation?.tool)){
   this.activeAnnotation.fillOpacity=this.shapeFillOpacity;
   this.redrawAnnotations();
  }
 }
 canRedoAnnotation(){return !!this.annotationRedoHistory.get(this.pageNumber)?.length;}
 pushUndoState(state){
  const page=this.pageNumber,undo=this.annotationHistory.get(page)||[];
  undo.push(state);if(undo.length>historyCap)undo.shift();
  this.annotationHistory.set(page,undo);this.annotationRedoHistory.delete(page);
 }
 commitAnnotationPage(next,remember=true){
  const before=remember?clone(this.annotationsOnPage()):null;
  if(!super.commitAnnotationPage(next,false))return false;
  if(remember)this.pushUndoState({local:before});
  return true;
 }
 applyHistory(source,destination,allowLegacy=false){
  if(!this.page||this.inlineSession)return false;
  const page=this.pageNumber,stack=source.get(page)||[];
  const entry=stack.at(-1);
  const current=clone(this.annotationsOnPage());
  if(!entry&&(!allowLegacy||!current.length))return false;
  const previous=entry?.local??current.slice(0,-1);
  const external=entry?.external;
  const externalNow=external?clone(this.annotations.pages[String(external.page)]||[]):null;
  if(external&&!same(externalNow,external.expected)){
   this.onWarning('L’altra pàgina ha canviat. No es poden recuperar els canvis sense perdre anotacions.');
   return false;
  }
  const draft={version:this.annotations.version,pages:{...this.annotations.pages}};
  if(previous.length)draft.pages[String(page)]=previous;
  else delete draft.pages[String(page)];
  if(external){
   if(external.previous.length)draft.pages[String(external.page)]=external.previous;
   else delete draft.pages[String(external.page)];
  }
  let clean;
  try{clean=normalizeAnnotations(draft);}catch(err){this.onWarning(err.message);return false;}
  const reverse={local:current};
  if(external)reverse.external={
   page:external.page,previous:externalNow,expected:clone(external.previous)
  };
  if(entry)stack.pop();
  if(stack.length)source.set(page,stack);else source.delete(page);
  const future=destination.get(page)||[];
  future.push(reverse);if(future.length>historyCap)future.shift();
  destination.set(page,future);
  this.annotations=clean;this.selectedAnnotation=null;
  this.redrawAnnotations();this.saveAnnotationDocument();this.notify();
  return true;
 }
 undoAnnotation(){return this.applyHistory(this.annotationHistory,this.annotationRedoHistory,true);}
 redoAnnotation(){return this.applyHistory(this.annotationRedoHistory,this.annotationHistory);}
 copySelectedAnnotation(cut=false){
  const ok=super.copySelectedAnnotation();
  if(ok){
   this.annotationClipboardCut=!!cut;
   this.annotationClipboardIndex=this.selectedAnnotation;
  }
  return ok;
 }
 duplicateSelectedAnnotation(){
  if(!this.annotationMode||!this.hasSelectedAnnotation()||this.inlineSession)return false;
  const copy=translatedStroke(clone(this.selectedAnnotationObject()),.025,.025);
  const index=this.annotationsOnPage().length;
  if(!this.commitAnnotationPage([...this.annotationsOnPage(),copy]))return false;
  this.selectedAnnotation=index;this.redrawAnnotations();this.notify();return true;
 }
 nudgeSelectedText(dx,dy){
  if(!this.annotationMode||this.selectedAnnotationObject()?.tool!=='text'||this.inlineSession)return false;
  const index=this.selectedAnnotation,old=this.selectedAnnotationObject();
  const next=translatedStroke(old,dx,dy);
  if(same(old,next))return false;
  if(!this.commitAnnotationPage(this.annotationsOnPage().map((item,i)=>i===index?next:item)))return false;
  this.selectedAnnotation=index;this.redrawAnnotations();this.notify();return true;
 }
 canMoveSelectedAnnotation(step){
  const index=this.selectedAnnotation;
  return this.hasSelectedAnnotation()&&index+Math.sign(step)>=0&&
   index+Math.sign(step)<this.annotationsOnPage().length;
 }
 orderSelectedAnnotation(step){
  if(!this.annotationMode||!this.canMoveSelectedAnnotation(step)||this.inlineSession)return false;
  const index=this.selectedAnnotation,target=index+Math.sign(step);
  const list=[...this.annotationsOnPage()];
  [list[index],list[target]]=[list[target],list[index]];
  if(!this.commitAnnotationPage(list))return false;
  this.selectedAnnotation=target;this.redrawAnnotations();this.notify();return true;
 }
 pasteCopiedAnnotation(){
  if(!this.annotationMode||!this.page||!this.annotationClipboard||this.inlineSession)return false;
  const original=clone(this.annotationClipboard);
  const box=objectBounds(original,Math.max(1,this.pageW),Math.max(1,this.pageH),this.rotation);
  const offset=this.annotationClipboardPage===this.pageNumber?
    [.03*(this.annotationPasteCount+1),.03*(this.annotationPasteCount+1)]:
    [.5-box.cx/Math.max(1,this.pageW),.5-box.cy/Math.max(1,this.pageH)];
  const pasted=translatedStroke(original,...offset);
  const sourcePage=this.annotationClipboardPage,cut=this.annotationClipboardCut;
  const targetList=this.annotationsOnPage();
  let nextTarget=[...targetList,pasted],sourceList=null,sourceIndex=-1;
  if(cut){
   sourceList=this.annotations.pages[String(sourcePage)]||[];
   sourceIndex=this.annotationClipboardIndex;
   if(!same(sourceList[sourceIndex],original))
    sourceIndex=sourceList.findIndex(item=>same(item,original));
   if(sourceIndex<0){
    this.onWarning('L’objecte original ha canviat. Torna a tallar-lo abans d’apegar.');
    return false;
   }
   if(sourcePage===this.pageNumber)
    nextTarget=[...targetList.filter((_,i)=>i!==sourceIndex),pasted];
  }
  if(cut&&sourcePage!==this.pageNumber){
   const nextSource=sourceList.filter((_,i)=>i!==sourceIndex);
   const draft={version:this.annotations.version,pages:{...this.annotations.pages}};
   if(nextSource.length)draft.pages[String(sourcePage)]=nextSource;
   else delete draft.pages[String(sourcePage)];
   draft.pages[String(this.pageNumber)]=nextTarget;
   let clean;
   try{clean=normalizeAnnotations(draft);}catch(e){this.onWarning(e.message);return false;}
   this.pushUndoState({
    local:clone(targetList),
    external:{page:sourcePage,previous:clone(sourceList),expected:clone(nextSource)}
   });
   this.annotations=clean;this.redrawAnnotations();this.saveAnnotationDocument();
  }else if(!this.commitAnnotationPage(nextTarget))return false;
  this.setAnnotationTool('select');
  this.selectedAnnotation=nextTarget.length-1;
  this.annotationPasteCount++;
  if(cut){
   this.annotationClipboardCut=false;
   this.annotationClipboard=clone(pasted);
   this.annotationClipboardPage=this.pageNumber;
   this.annotationClipboardIndex=this.selectedAnnotation;
   this.annotationPasteCount=0;
  }
  this.redrawAnnotations();this.notify();return true;
 }
}
