'use strict';
const $=s=>document.querySelector(s), key='qingzhuan-history-v1';
let history=[],results=[],busy=false,totalBytes=0,toastTimer;
try{const h=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(h))history=h.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&Number.isFinite(r.time)).slice(0,200)}catch{}
const outputs=new Map();
// Record IDs also work over plain HTTP during initial server setup.
function newRecordId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000)}
function persist(){try{localStorage.setItem(key,JSON.stringify(history))}catch{toast('浏览器未允许保存记录，本次仍可转换和下载。')}}
function record(r){history.unshift({...r});history=history.slice(0,200);persist()}
function row(r,hist=false){const available=outputs.has(r.id);return `<div class="file-row"><span class="file-icon">${r.status==='error'?'PNG':'JPG'}</span><div class="file-info"><span class="file-name" title="${esc(r.name)}">${esc(r.name)}</span><div class="file-meta">${hist?esc(new Date(r.time).toLocaleString('zh-CN',{hour12:false}))+' · ':''}${size(r.inputSize||0)}${r.outputSize?' → '+size(r.outputSize)+' · '+r.width+' × '+r.height:''}${r.error?' · '+esc(r.error):''}</div></div><span class="file-status ${r.status==='error'?'error':''}">${r.status==='processing'?'转换中…':r.status==='error'?'转换失败':'✓ 转换完成'}</span>${available?`<button class="download-btn" data-download="${r.id}">↓ 下载</button>`:r.status==='success'?'<span class="file-meta">图片已释放</span>':''}</div>`}
function render(){const good=results.filter(r=>r.status==='success').length;$('#resultCount').textContent=results.length;$('#historyCount').textContent=history.length;$('#resultHint').textContent=busy?'正在逐张转换，请稍候…':results.length?`已完成 ${good} 张${results.some(r=>r.status==='error')?' · 部分文件转换失败，可查看原因':''}，原始图片未保存`:'选择图片后自动开始转换';$('#resultList').innerHTML=results.length?results.map(r=>row(r)).join(''):'<div class="empty"><span>▧</span><p>你的 JPG 图片将在这里准备就绪</p><small>上传图片，开始第一次转换</small></div>';$('#downloadAll').disabled=busy||!outputs.size;$('#clearResults').disabled=busy||!results.length;$('#quality').disabled=busy;$('#dropzone').classList.toggle('busy',busy);$('#dropzone').setAttribute('aria-disabled',String(busy));renderHistory()}
function renderHistory(){const query=$('#search').value.trim().toLowerCase();const list=history.filter(r=>r.name.toLowerCase().includes(query));$('#historyList').innerHTML=list.length?list.map(r=>row(r,true)).join(''):`<div class="empty"><span>◷</span><p>${query?'没有匹配的文件':'还没有转换记录'}</p><small>${query?'试试其他文件名':'完成转换后，文件信息会出现在这里'}</small></div>`;$('#clearHistory').disabled=!history.length}
function switchPage(p){p=p==='history'?'history':'convert';$('#convertPage').hidden=p!=='convert';$('#historyPage').hidden=p!=='history';$('.nav.active')?.classList.remove('active');$(`[data-page="${p}"]`).classList.add('active');$('#breadcrumb').innerHTML='工作台 <span>/</span> '+(p==='history'?'上传历史':'图片转换');renderHistory()}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.page}));window.addEventListener('hashchange',()=>switchPage(location.hash.slice(1)));
$('#quality').addEventListener('input',e=>$('#qualityValue').textContent=e.target.value+'%');$('#search').addEventListener('input',renderHistory);
$('#dropzone').addEventListener('click',e=>{if(busy){e.preventDefault();toast('正在转换，请完成后继续添加')}});
$('#dropzone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!busy)$('#fileInput').click()}});
$('#fileInput').addEventListener('change',async e=>{let files=Array.from(e.target.files);e.target.value='';await process(files)});
for(const event of ['dragenter','dragover'])$('#dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('#dropzone').classList.add('drag')});
$('#dropzone').addEventListener('dragleave',()=>$('#dropzone').classList.remove('drag'));
$('#dropzone').addEventListener('drop',async e=>{e.preventDefault();$('#dropzone').classList.remove('drag');await process(Array.from(e.dataTransfer.files))});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
async function convert(file,quality){
 if(file.size>20*1048576)throw Error('超过每张 20 MB 的限制');
 const header=new Uint8Array(await file.slice(0,24).arrayBuffer());
 if(header.length<24||![137,80,78,71,13,10,26,10].every((n,i)=>header[i]===n)||String.fromCharCode(...header.slice(12,16))!=='IHDR')throw Error('请选择有效的 PNG 图片');
 const view=new DataView(header.buffer),w=view.getUint32(16),h=view.getUint32(20);
 if(!w||!h||w*h>40000000||w>16384||h>16384)throw Error('图片尺寸过大，最多 4000 万像素且单边不超过 16384');
 let source,objectUrl,canvas;
 try{if(typeof createImageBitmap==='function')source=await createImageBitmap(file);else{objectUrl=URL.createObjectURL(file);source=new Image();source.src=objectUrl;await source.decode()}
 canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器无法创建画布');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('转换失败，请尝试较小的图片')),'image/jpeg',quality));if(blob.type!=='image/jpeg')throw Error('浏览器不支持 JPG 编码');return {blob,width:w,height:h};
 }finally{source?.close?.();if(source instanceof HTMLImageElement)source.src='';if(objectUrl)URL.revokeObjectURL(objectUrl);if(canvas){canvas.width=0;canvas.height=0}}
}
async function process(files){if(busy){files.length=0;toast('正在转换，请完成后继续添加');return}if(!files.length)return;if(files.length>50){files.length=0;toast('每次最多选择 50 张图片，请分批转换');return}
 busy=true;const quality=Number($('#quality').value)/100;render();
 try{for(let i=0;i<files.length;i++){let file=files[i];const r={id:newRecordId(),name:file.name,inputSize:file.size,time:Date.now(),status:'processing'};results.push(r);render();await new Promise(resolve=>setTimeout(resolve,0));try{if(totalBytes>250*1048576)throw Error('下载并清空当前列表后，可继续转换');const output=await convert(file,quality);Object.assign(r,{status:'success',outputSize:output.blob.size,width:output.width,height:output.height});const safeName=file.name.replace(/\.png$/i,'').replace(/[\\/\x00-\x1f]/g,'_')||'image';outputs.set(r.id,{blob:output.blob,name:safeName+'.jpg'});totalBytes+=output.blob.size}catch(e){r.status='error';r.error=e.message.includes('PNG')||e.message.includes('限制')||e.message.includes('尺寸')||e.message.includes('清空')?e.message:'图片无法解码或转换，请检查文件后重试'}finally{files[i]=null;file=null;record(r);render()}}}finally{files.length=0;busy=false;render()}toast('处理完成，可下载转换成功的图片')}
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-download]');if(b){const f=outputs.get(b.dataset.download);if(f)save(f.blob,f.name)}});
$('#clearResults').addEventListener('click',()=>{outputs.clear();results=[];totalBytes=0;render();toast('列表已清空，图片已释放；文件信息保留在历史中')});
$('#clearHistory').addEventListener('click',()=>{if(!confirm('清空当前浏览器中的全部历史记录？'))return;history=[];persist();render();toast('历史记录已清空')});
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
// ZIP store: UTF-8 names, CRC-32, and a central directory; no external upload or library.
async function makeZip(entries){const parts=[],central=[],encoder=new TextEncoder();let offset=0;const names=new Set();for(const f of entries){let name=f.name,n=2;while(names.has(name))name=f.name.replace(/\.jpg$/i,'')+' ('+(n++)+').jpg';names.add(name);const bytes=new Uint8Array(await f.blob.arrayBuffer()),filename=encoder.encode(name),crc=crc32(bytes);const head=new Uint8Array(30+filename.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,filename.length,true);head.set(filename,30);parts.push(head,bytes);const c=new Uint8Array(46+filename.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);c.set(filename,46);central.push(c);offset+=head.length+bytes.length}const length=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
$('#downloadAll').addEventListener('click',async()=>{const button=$('#downloadAll');button.disabled=true;try{const entries=Array.from(outputs.values());if(entries.length)save(await makeZip(entries),'轻转-JPG图片.zip')}catch{toast('打包失败，请尝试逐张下载')}finally{button.disabled=busy||!outputs.size}});
switchPage(location.hash.slice(1));render();
