(()=> {
const $=id=>document.getElementById(id), cfg=window.ELEMENTA_CONFIG||{};
const login=$("login"), app=$("app"), loginMsg=$("loginMsg"), globalMsg=$("globalMsg");
const say=(el,msg,kind="")=>{el.textContent=msg;el.className="notice"+(kind?" "+kind:"");el.classList.remove("hidden")};
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){say(loginMsg,"The database connection is not configured. Please contact the site owner.","error");return}
const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let allReviews=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function isAdmin(){const {data,error}=await client.rpc("elementa_is_admin");if(error)throw error;if(data!==true)throw new Error("This account is not authorized as an Elementa admin.");return true}
async function showApp(user){await isAdmin();login.classList.add("hidden");app.classList.remove("hidden");$("signedIn").textContent=user.email||"Signed in";await refresh()}
function signedOut(){app.classList.add("hidden");login.classList.remove("hidden")}
async function refresh(){globalMsg.classList.add("hidden");$("reviews").innerHTML='<div class="empty">Loading reviews…</div>';$("reports").innerHTML='<div class="empty">Loading reports…</div>';
const [r,q]=await Promise.all([client.rpc("elementa_admin_list_reviews",{p_limit:100,p_offset:0}),client.rpc("elementa_admin_list_reports",{p_limit:100})]);
if(r.error)throw r.error;if(q.error)throw q.error;allReviews=r.data||[];$("reviewCount").textContent=allReviews.length;$("reportCount").textContent=(q.data||[]).length;renderReviews();renderReports(q.data||[])}
function renderReviews(){const f=$("filter").value,rows=allReviews.filter(x=>f==="all"||x.status===f);$("reviews").innerHTML=rows.length?rows.map(r=>'<article class="review" data-id="'+esc(r.id)+'"><div class="row"><h3 class="grow">'+esc(r.name)+'</h3><span class="stars">'+("★".repeat(r.rating))+'</span><span class="pill">'+esc(r.status)+'</span></div><p>'+esc(r.body)+'</p><div class="muted">'+new Date(r.created_at).toLocaleString()+' · '+r.report_count+' report(s)</div><div class="actions"><button data-action="visible">Show</button><button data-action="hidden">Hide</button><button data-action="flagged">Flag</button><button data-action="edit">Edit</button><button class="danger" data-action="delete">Delete</button></div></article>').join(""):'<div class="empty">No reviews in this filter.</div>'}
function renderReports(rows){$("reports").innerHTML=rows.length?rows.map(r=>'<article class="review"><div><b>Review ID:</b> <code>'+esc(r.review_id)+'</code></div><p>'+esc(r.reason||"No reason provided")+'</p><div class="muted">'+new Date(r.created_at).toLocaleString()+'</div></article>').join(""):'<div class="empty">No reports yet.</div>'}
async function action(id,what){const r=allReviews.find(x=>x.id===id);if(!r)return;
if(what==="delete"){if(!confirm("Permanently delete this review?"))return;const {error}=await client.rpc("elementa_admin_delete_review",{p_id:id});if(error)throw error}
else if(what==="edit"){const name=prompt("Display name (2–40 characters):",r.name);if(name===null)return;const rating=Number(prompt("Rating (1–5):",String(r.rating)));if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error("Rating must be from 1 to 5.");const body=prompt("Review text (10–1000 characters):",r.body);if(body===null)return;const {error}=await client.rpc("elementa_admin_edit_review",{p_id:id,p_name:name,p_rating:rating,p_body:body});if(error)throw error}
else{const {error}=await client.rpc("elementa_admin_set_review_status",{p_id:id,p_status:what});if(error)throw error}
say(globalMsg,"Review updated successfully.","ok");await refresh()}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginBtn").disabled=true;try{const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)throw error;await showApp(data.user)}catch(err){say(loginMsg,err.message||"Sign in failed.","error");await client.auth.signOut()}finally{$("loginBtn").disabled=false}});
$("logout").onclick=async()=>{await client.auth.signOut();signedOut()};
$("refresh").onclick=()=>refresh().catch(e=>say(globalMsg,e.message,"error"));
$("filter").onchange=renderReviews;
$("reviews").addEventListener("click",e=>{const b=e.target.closest("button[data-action]"),card=e.target.closest("[data-id]");if(!b||!card)return;action(card.dataset.id,b.dataset.action).catch(err=>say(globalMsg,err.message||"Action failed.","error"))});
client.auth.onAuthStateChange((_event,session)=>{if(!session)signedOut()});
client.auth.getSession().then(({data,error})=>{if(error)throw error;if(data.session)return showApp(data.session.user);signedOut()}).catch(e=>{signedOut();say(loginMsg,e.message||"Could not verify admin access.","error")});
})();