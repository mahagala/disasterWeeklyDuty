const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto, createHash } = require('node:crypto');
const source = fs.readFileSync('app.js', 'utf8');
function environment() {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {style:{}, textContent:'', disabled:false,
      classList:{ add:(...x)=>x.forEach(v=>classes.add(v)), remove:(...x)=>x.forEach(v=>classes.delete(v)), toggle:(v,force)=>force ? classes.add(v) : classes.delete(v), contains:v=>classes.has(v)},
      setAttribute(){}, replaceChildren(){}, appendChild(){}, querySelector(){return this;} };
  }
  const get = id => { if (!elements.has(id)) elements.set(id,element()); return elements.get(id); };
  let failManifest = false;
  const records = name => [{id:name, source:name, title:'Flood',pubDate:new Date().toISOString(),lat:null,lng:null}];
  const manifest = {schemaVersion:1, generatedAt:new Date().toISOString(), feeds:{}};
  for (const [key,name] of Object.entries({gdacs:'GDACS',ercc:'ERCC',usgs:'USGS'})) {
    manifest.feeds[key] = {source:key,file:key+'.xml',status:'ok',available:true,lastSuccessAt:new Date().toISOString()};
  }
  manifest.feeds.reliefweb = {source:'reliefweb',status:'unconfigured',available:false};
  const requests=[];
  const context = vm.createContext({document:{addEventListener(){},getElementById:get,createElement:element}, console, setTimeout,clearTimeout,AbortController,TextDecoder,TextEncoder,crypto:webcrypto,location:{protocol:'http:'},
    fetch:async url=>{
      requests.push(url);
      if (url.includes('manifest') && failManifest) throw new Error('Network unavailable');
      const value = url.includes('manifest') ? manifest : records(url.includes('gdacs')?'GDACS':url.includes('ercc')?'ERCC':'USGS');
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      return {ok:true, arrayBuffer:async()=>bytes.buffer};
    }});
  vm.runInContext(source,context);
  vm.runInContext("CONFIG.enableNominatim=false; filterAndDisplayData=()=>{}; correctTaiwanCountry=()=>{}; showToast=()=>{}; for (const key of Object.keys(FEED_PARSERS)) FEED_PARSERS[key]=JSON.parse;",context);
  return {context,manifest,get,requests,fail:()=>failManifest=true,run:()=>vm.runInContext('loadData()',context),data:()=>JSON.parse(vm.runInContext('JSON.stringify(allDisasters)',context))};
}
test('loads available sources from same origin and leaves ReliefWeb unconfigured',async()=>{
  const e=environment(); await e.run(); assert.equal(e.data().length,3);
  assert(e.get('status-reliefweb').classList.contains('unconfigured'));
  assert(e.requests.every(url=>url.startsWith('data/')));
  assert.equal(e.get('fetch-btn').disabled,false);
});
test('network failure retains real records and marks them stale',async()=>{
  const e=environment(); await e.run(); const previous=e.data();e.fail();await e.run();
  assert.deepEqual(e.data(),previous);assert(e.get('status-gdacs').classList.contains('stale'));
});
test('one source failure does not prevent others loading',async()=>{
  const e=environment();e.manifest.feeds.ercc.available=false;e.manifest.feeds.ercc.status='error';await e.run();
  assert.equal(e.data().length,2);assert(e.get('status-ercc').classList.contains('error'));assert(e.get('status-usgs').classList.contains('active'));
});
test('successful but old downloads are visibly stale',async()=>{
  const e=environment();e.manifest.feeds.gdacs.lastSuccessAt='2020-01-01T00:00:00Z';await e.run();
  assert(e.get('status-gdacs').classList.contains('stale'));
});
test('digest mismatch does not replace previously loaded records',async()=>{
  const e=environment();await e.run();e.manifest.feeds.gdacs.sha256='bad-digest';await e.run();
  assert.equal(e.data().length,3);assert(e.get('status-gdacs').classList.contains('stale'));
});
test('hash checks raw UTF-8 bytes including BOM before decoding XML',async()=>{
  const e=environment();const bytes=Buffer.from('\ufeff<rss/>');
  e.context.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  const hash=createHash('sha256').update(bytes).digest('hex');
  const value=await vm.runInContext(`fetchSiteData('data/example.xml',false,'${hash}')`,e.context);
  assert.equal(value,'<rss/>');
});
test('date range uses event overlap and excludes dates outside the range',()=>{
  const e=environment();
  // Restore the real filtering function; keep rendering isolated from this unit test.
  const start=source.indexOf('function filterAndDisplayData()');
  const end=source.indexOf('// 僅渲染表格',start);
  vm.runInContext(source.slice(start,end),e.context);
  e.get('time-range').value='custom';e.get('start-date').value='2000-01-01';e.get('end-date').value='2000-01-07';e.get('table-search').value='';
  for(const id of ['alert-red','alert-orange','alert-green','alert-none','source-gdacs','source-ercc','source-usgs','source-reliefweb','cat-tc','cat-fl','cat-eq','cat-vo','cat-wf','cat-dr','cat-other'])e.get(id+'-chk').checked=true;
  vm.runInContext(`renderMapMarkers=()=>{};renderTable=()=>{};renderStats=()=>{};
    allDisasters=[{id:'overlap',source:'GDACS',type:'FL',pubDate:'2000-01-05',fromdate:'1999-12-25',todate:'2000-01-02'},
      {id:'outside',source:'GDACS',type:'FL',pubDate:'2026-09-28'}];
    filterAndDisplayData();`,e.context);
  assert.equal(vm.runInContext('currentFilteredDisasters.length',e.context),1);
  assert.equal(vm.runInContext('currentFilteredDisasters[0].id',e.context),'overlap');
});
test('CSV exports only current filtered records',()=>{
  const e=environment();let output='';
  e.context.Blob=class {constructor(parts){output=parts.join('');}};
  e.context.URL={createObjectURL:()=> 'blob:test'};
  e.context.document.body={appendChild(){},removeChild(){}};
  const original=e.context.document.createElement;e.context.document.createElement=()=>({...original(),click(){}});
  vm.runInContext(`allDisasters=[{id:'excluded'}];currentFilteredDisasters=[{id:'included',pubDate:'2026-09-28',country:'Japan',type:'FL',title:'included flood',description:'included flood',link:'https://example.com',lat:35,lng:139}];exportToCSV();`,e.context);
  assert(output.includes('included flood'));assert(!output.includes('excluded'));assert.equal(output.trim().split('\n').length,2);
});
