(()=>{const $=id=>document.getElementById(id),C=window.ELEMENTA_CONFIG||{},ON=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY),PS=5;let off=0,total=0,t0=Date.now(),busy=false;
const E={too_fast:"Please take a few more seconds to write your review.",bad_name:"Please enter a display name of 2–40 characters.",bad_rating:"Please choose a rating from 1 to 5 stars.",bad_body:"Your review must be 10–1000 characters.",not_allowed:"Links and HTML are not allowed in names or reviews.",rate_limited:"You have reached the hourly limit. Please try again later.",busy:"Many reviews are arriving right now. Please try again in a little while.",not_found:"That review no longer exists."};
const stars=n=>"★".repeat(n)+"☆".repeat(5-n);
async function rpc(fn,a){const r=await fetch(C.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:C.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify(a||{})});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error(j&&j.message||"network");return j}
const msg=(t,ok)=>{const m=$("rm");m.textContent=t;m.className=ok?"ok-m":"err-m"};
async function stats(){try{const s=await rpc("review_stats");total=s.count;$("rs2").textContent=s.count?`${Number(s.average).toFixed(1)} / 5 average · ${s.count} review${s.count==1?"":"s"}`:"No reviews yet."}catch{$("rs2").textContent="Could not load the rating summary."}}
function item(r){const li=document.createElement("li"),h=document.createElement("div"),n=document.createElement("b"),st=document.createElement("span"),d=document.createElement("small"),p=document.createElement("p"),b=document.createElement("button");
n.textContent=r.name;st.textContent=" "+stars(r.rating);st.className="gold";st.setAttribute("role","img");st.setAttribute("aria-label",r.rating+" out of 5 stars");d.textContent=" · "+new Date(r.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});d.className="mut";
p.textContent=r.body;b.className="lk";b.textContent="Report";b.setAttribute("aria-label","Report this review by "+r.name);
b.onclick=async()=>{if(b.dataset.c!="1"){b.dataset.c="1";b.textContent="Confirm report";return}b.disabled=true;try{await rpc("report_review",{p_id:r.id});b.textContent="Reported — thank you"}catch(e){b.disabled=false;b.dataset.c="";b.textContent=E[e.message]||"Report failed — retry"}};
h.append(n,st,d);li.append(h,p,b);return li}
async function load(reset){if(reset){off=0;$("rl").innerHTML=""}const mb=$("rmore");mb.hidden=true;
try{const rows=await rpc("list_reviews",{p_limit:PS,p_offset:off});rows.forEach(r=>$("rl").append(item(r)));off+=rows.length;$("re").hidden=off>0;if(!off)$("re").textContent="No reviews yet. Be the first to rate Elementa.";mb.hidden=rows.length<PS||(total>0&&off>=total)}catch{$("re").hidden=false;$("re").textContent="Could not load reviews right now. Please try again later."}}
if(!ON){$("rs2").textContent="";$("re").textContent="Reviews will appear here once the review database is connected.";$("rf").querySelectorAll("input,textarea,button").forEach(x=>x.disabled=true);msg("The review form is switched off until the database is configured.",false);return}
document.querySelectorAll('#rf input[name=rt]').forEach(i=>i.addEventListener("change",()=>{document.querySelectorAll(".stars label").forEach((l,k)=>l.classList.toggle("on",k<+i.value))}));
$("rb").addEventListener("input",()=>$("rc").textContent=$("rb").value.length+" / 1000");
$("rmore").onclick=()=>load(false);
$("rf").addEventListener("submit",async e=>{e.preventDefault();if(busy)return;const rt=+(document.querySelector("#rf input[name=rt]:checked")||{}).value,n=$("rn").value.trim(),b=$("rb").value.trim();
if(!rt)return msg(E.bad_rating,false);if(n.length<2||n.length>40)return msg(E.bad_name,false);if(b.length<10||b.length>1000)return msg(E.bad_body,false);
busy=true;$("rsub").disabled=true;msg("Submitting…",true);
try{await rpc("submit_review",{p_name:n,p_rating:rt,p_body:b,p_hp:$("rw").value,p_elapsed_ms:Date.now()-t0});msg("Thank you! Your review has been published.",true);$("rf").reset();document.querySelectorAll(".stars label").forEach(l=>l.classList.remove("on"));$("rc").textContent="0 / 1000";t0=Date.now();await stats();await load(true)}
catch(x){msg(E[x.message]||"Something went wrong. Please check your connection and try again.",false)}finally{busy=false;$("rsub").disabled=false}});
stats().then(()=>load(true))})();
