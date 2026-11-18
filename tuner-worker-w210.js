/* W2.10 — El YIN s'executa fora del fil d'interfície. Cap àudio es guarda ni s'envia. */
import {detectPitchYin} from './tuner-w210.js';
self.onmessage=e=>{
 const {generation,samples,sampleRate}=e.data||{};
 if(!(samples instanceof Float32Array))return;
 try{self.postMessage({generation,result:detectPitchYin(samples,sampleRate)});}
 catch{self.postMessage({generation,result:null});}
};
