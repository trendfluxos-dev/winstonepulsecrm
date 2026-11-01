/**
 * Inline boot script that recovers a tab from failed module/chunk downloads
 * (stale deployment, a deployment still uploading, a restarting preview).
 *
 * Rules (all bounded — never an infinite reload loop):
 * - Every failure kind funnels into one coalesced recovery run per page load.
 * - Before reloading, the page AND the /assets/ files it references are probed
 *   with no-store requests. Reloading while a referenced chunk is still missing
 *   only repeats the failure (iPhone Safari reported "Importing a module script
 *   failed." four times in three seconds, then the fallback, on 2026-10-31/11-01).
 * - Production: at most 3 automatic reloads per tab, spaced by a backoff. Then a
 *   fallback screen with "Try again". While the fallback shows, a slow watcher
 *   keeps probing; if the probe was failing and later passes, the tab reloads
 *   ONE more time (sessionStorage guard), then never again automatically.
 * - Nothing here touches auth storage, the offline queue or any CRM data; only
 *   the recovery keys below and the winstone-shell-* asset caches.
 *
 * Kept as a plain string so tests can execute exactly what ships.
 */
export type DeployRecoveryOptions = { dev: boolean; pattern: RegExp };

export const DEPLOY_RECOVERY_KEY = "deployment-reload-attempted";

export function buildDeployRecoveryScript({ dev, pattern }: DeployRecoveryOptions): string {
  return `(function(){
var DEV=${dev ? "true" : "false"};
var K=${JSON.stringify(DEPLOY_RECOVERY_KEY)};
var MAX_RELOADS=3;
var BACKOFF=[0,2000,5000];
var PROBE_LIMIT=DEV?60:15;
var SLOW_POLLS=360;
var LATE_POLLS=40;
function ss(){try{return window.sessionStorage}catch(e){return null}}
function sget(k){try{var s=ss();return s?s.getItem(k):null}catch(e){return null}}
function sset(k,v){try{var s=ss();if(s)s.setItem(k,v)}catch(e){}}
function sdel(k){try{var s=ss();if(s)s.removeItem(k)}catch(e){}}
function attempted(){return sget(K)==="1"}
function mark(){sset(K,"1")}
function n(){return +(sget(K+":n")||0)}
function clearAll(){sdel(K);sdel(K+":n");sdel(K+":k");sdel(K+":late")}
function bn(){try{return window.localStorage.getItem("winstone.lang")==="bn"}catch(e){return false}}
function hardRetry(){clearAll();var jobs=[];try{if(window.caches)jobs.push(window.caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x.indexOf("winstone-shell-")===0}).map(function(x){return window.caches.delete(x)}))}))}catch(e){}try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.update().catch(function(){})}))}))}catch(e){}var go=function(){var u=new URL(location.href);u.searchParams.set("_fresh",String(Date.now()));location.replace(u.toString())};Promise.race([Promise.all(jobs),new Promise(function(r){setTimeout(r,2500)})]).then(go,go)}
function fallback(){if(document.getElementById("deploy-recovery"))return;var B=bn();var d=document.createElement("div");d.id="deploy-recovery";d.setAttribute("role","alertdialog");d.setAttribute("aria-labelledby","deploy-recovery-title");d.style.cssText="position:fixed;inset:0;z-index:99999;background:var(--background,#fbf9f4);color:var(--foreground,#1c1917);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;text-align:center;padding:24px";var h=document.createElement("div");h.id="deploy-recovery-title";h.style.cssText="font-size:20px;font-weight:700";h.textContent=B?"পেজটি পুরোপুরি লোড হয়নি":"This page didn't finish loading";var p=document.createElement("div");p.style.cssText="font-size:14px;opacity:.75;max-width:340px;line-height:1.5";p.textContent=B?"অ্যাপের নতুন সংস্করণ এসেছে বা নেটওয়ার্ক দুর্বল ছিল। আপনার সেভ করা কাজ নিরাপদ আছে। “আবার চেষ্টা করুন” চাপুন।":"A new version arrived or the connection dropped. Your saved work is safe. Tap “Try again”.";var b=document.createElement("button");b.type="button";b.style.cssText="margin-top:8px;min-height:44px;padding:10px 24px;font-size:15px;font-weight:600;color:var(--primary-foreground,#fff);background:var(--primary,#1c1917);border:none;border-radius:8px;cursor:pointer";b.textContent=B?"আবার চেষ্টা করুন":"Try again";b.onclick=function(){b.disabled=true;b.textContent=B?"লোড হচ্ছে…":"Loading…";hardRetry()};var hm=document.createElement("a");hm.href="/";hm.style.cssText="font-size:13px;color:inherit;opacity:.7;text-decoration:underline";hm.textContent=B?"হোম পেজে যান":"Go to the home page";hm.onclick=function(){clearAll()};var q=document.createElement("div");q.style.cssText="font-size:12px;opacity:.6;max-width:320px";q.textContent=B?"বারবার এমন হলে IT-কে জানান।":"If this keeps happening, tell IT.";d.appendChild(h);d.appendChild(p);d.appendChild(b);d.appendChild(hm);d.appendChild(q);(document.body||document.documentElement).appendChild(d);try{b.focus()}catch(e){}}
function notice(){if(document.getElementById("deploy-notice"))return;var d=document.createElement("div");d.id="deploy-notice";d.setAttribute("role","status");d.style.cssText="position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99998;background:#1c1917;color:#fff;padding:10px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25)";d.textContent=bn()?"নতুন সংস্করণ লোড হচ্ছে… একটু অপেক্ষা করুন":"Loading the new version… one moment";(document.body||document.documentElement).appendChild(d)}
var SENT=0;
function send(kind,msg,rec){if(SENT>=10)return;SENT++;try{var o={kind:String(kind).slice(0,60),message:String(msg||kind).slice(0,1500),route:location.pathname};if(rec)o.recovery=rec;var b=JSON.stringify(o);if(navigator.sendBeacon){navigator.sendBeacon("/api/public/telemetry/runtime-error",new Blob([b],{type:"application/json"}))}else{F0("/api/public/telemetry/runtime-error",{method:"POST",body:b,headers:{"content-type":"application/json"},keepalive:true})}}catch(x){}}
var F0=window.fetch?window.fetch.bind(window):null;
window.__winstoneReportError=send;
function log(kind,detail){var e={at:new Date().toISOString(),kind:kind,detail:String(detail||"").slice(0,300),page:location.pathname,reloaded:attempted()};try{var L=JSON.parse(window.localStorage.getItem("winstone-reload-log")||"[]");L.push(e);window.localStorage.setItem("winstone-reload-log",JSON.stringify(L.slice(-20)))}catch(x){}var ok=kind==="recovered-after-reload";try{(ok?console.info:console.error)("[winstone-recovery]",JSON.stringify(e))}catch(x){}var failed=kind==="fallback-shown"||kind==="server-unreachable"||kind==="assets-unavailable";var rec=ok?"recovered":failed?"failed":"reloading";var org=null;try{org=JSON.parse(sget(K+":k")||"null")}catch(x){}if(rec==="reloading"){sset(K+":k",JSON.stringify({kind:kind,detail:e.detail}));send(kind,e.detail||kind,rec)}else if(org){send(org.kind,org.detail||org.kind,rec)}else if(!ok){send(kind,e.detail||kind)}if(kind==="fallback-shown")try{window.__lovableReportRuntimeError&&window.__lovableReportRuntimeError({message:"Module load recovery: "+kind+" — "+e.detail,filename:location.pathname})}catch(x){}}
function timed(url,method){if(!F0)return Promise.resolve(null);var c=typeof AbortController!=="undefined"?new AbortController():null;var t=setTimeout(function(){if(c)c.abort()},4000);return F0(url,{method:method,cache:"no-store",credentials:"same-origin",signal:c?c.signal:undefined}).then(function(r){clearTimeout(t);return r},function(){clearTimeout(t);return null})}
function assetsIn(html){var out=[],seen={},re=/(?:src|href)=["'](\\/assets\\/[^"'?#]+\\.(?:m?js|css))["']/g,m;while((m=re.exec(String(html||"")))&&out.length<24){if(!seen[m[1]]){seen[m[1]]=1;out.push(m[1])}}return out}
// Resolves "ready" only when the page and every /assets/ file it references answer.
function probe(){return timed(location.pathname+location.search,"GET").then(function(res){if(!res)return "down";if(!res.ok)return "down";return res.text().then(function(html){var list=assetsIn(html);if(!list.length)return "ready";return Promise.all(list.map(function(u){return timed(u,"HEAD").then(function(r){return !!(r&&(r.ok||r.status===405))})})).then(function(all){for(var i=0;i<all.length;i++)if(!all[i])return "assets";return "ready"})},function(){return "down"})})}
var recovering=false;
function reloadSoon(){setTimeout(function(){location.reload()},300)}
function lateWatch(){if(DEV||sget(K+":late")==="1")return;var polls=0,sawFailure=false;function tick(){probe().then(function(state){if(state!=="ready"){sawFailure=true}else if(sawFailure){sset(K+":late","1");sset(K+":n","0");log("late-retry","");reloadSoon();return}if(++polls<LATE_POLLS)setTimeout(tick,15000)})}setTimeout(tick,15000)}
function waitThenReload(c){var t=0,shown=false;function attempt(){probe().then(function(state){if(state==="ready"){reloadSoon();return}++t;if(t>=PROBE_LIMIT&&!shown){shown=true;log(state==="assets"?"assets-unavailable":"server-unreachable","");fallback()}if(t>=PROBE_LIMIT+SLOW_POLLS){recovering=false;return}setTimeout(attempt,shown?5000:2000)})}setTimeout(attempt,DEV?0:BACKOFF[Math.min(c,BACKOFF.length-1)])}
function r(kind,detail){if(recovering)return;recovering=true;log(kind,detail);var c=n();if(!DEV&&attempted()&&c>=MAX_RELOADS){log("fallback-shown",detail);fallback();lateWatch();return}mark();sset(K+":n",String(c+1));notice();waitThenReload(c)}
function bad(m){return ${pattern.toString()}.test(String(m||""))}
window.__winstoneRecover=r;
if(F0){window.fetch=function(){var a=arguments;return F0.apply(window,a).then(function(res){try{var u=String(a[0]&&a[0].url||a[0]);if(res.status===500&&u.indexOf("/_serverFn/")>=0){res.clone().text().then(function(t){if(/Invalid server function ID/i.test(t))r("stale-server-fn",u.split("?")[0].slice(-80))}).catch(function(){})}}catch(x){}return res})}}
window.addEventListener("winstone:module-load-error",function(e){if(bad(e.detail))r("caught-route-import",e.detail)});
window.addEventListener("vite:preloadError",function(e){if(e.preventDefault)e.preventDefault();r("preload-error",e.payload&&e.payload.message)});
window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"){r("script-load-failed",t.src);return}if(bad(e.message))r("module-error",e.message)},true);
window.addEventListener("unhandledrejection",function(e){var m=e.reason&&e.reason.message||e.reason;if(bad(m)){r("import-rejected",m);return}send("unhandled-rejection",m)});
window.addEventListener("error",function(e){if(e.target&&e.target!==window)return;if(bad(e.message))return;if(!e.message||/ResizeObserver loop/.test(e.message))return;send("runtime-error",e.message+(e.filename?" @ "+String(e.filename).split("?")[0]+":"+e.lineno:""))});
window.__clearDeployReloadFlag=function(){if(recovering)return;var d=document.getElementById("deploy-notice");if(d&&d.remove)d.remove();var f=document.getElementById("deploy-recovery");if(f&&f.remove)f.remove();if(attempted())log("recovered-after-reload","");clearAll()};
})();`;
}
