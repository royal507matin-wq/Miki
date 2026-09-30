const $ = s => document.querySelector(s);
const login = $("#login"), home = $("#home"), chat = $("#chat");
const password = $("#password"), loginBtn = $("#loginBtn"), loginError = $("#loginError");
const messagesEl = $("#messages"), input = $("#messageInput"), sendBtn = $("#sendBtn");
let chatController = null;

let chats = JSON.parse(localStorage.getItem("mikazi_chats") || '{"main":{"title":"گفتگوی جدید","messages":[]}}'); let currentChat = "main"; let messages = chats[currentChat].messages;

function spawnParticles(){
  const box = $("#particles");
  for(let i=0;i<28;i++){
    const p=document.createElement("i");
    p.className="particle";
    p.style.left=Math.random()*100+"%";
    p.style.animationDuration=(7+Math.random()*10)+"s";
    p.style.animationDelay=(-Math.random()*15)+"s";
    p.style.opacity=.2+Math.random()*.7;
    box.appendChild(p);
  }
}
spawnParticles();

function show(view){
  [login,home,chat].forEach(x=>x.classList.add("hidden"));
  view.classList.remove("hidden");
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function renderMessages(){
  messagesEl.innerHTML="";
  if(!messages.length){
    addMessage("assistant","سلام 👋 من MIKAZI هستم.\nهر چیزی خواستی بپرس؛ از ایده و برنامه‌ریزی تا توضیح مفاهیم و حل مسئله.");
    messages.shift(); // keep the welcome message visual-only
  }
  messages.forEach(m=>{
    const row=document.createElement("div");
    row.className="message "+m.role;
    row.innerHTML=`<div class="bubble">${m.role==="assistant" ? formatMarkdown(m.content) : escapeHtml(m.content)}</div>${m.role==="assistant" ? '<div class="message-actions"><button class="copy-btn" type="button">⧉</button><button class="regen-btn" type="button">↻</button></div>' : ''}`;
    messagesEl.appendChild(row);
  });
  messagesEl.scrollTop=messagesEl.scrollHeight;
}
function addMessage(role,content,animate=true){
  const row=document.createElement("div");
  row.className="message "+role;
  row.innerHTML = `<div class="bubble">${role==="assistant" ? formatMarkdown(content) : escapeHtml(content)}</div>${role==="assistant" ? '<div class="message-actions"><button class="copy-btn" type="button" aria-label="کپی پاسخ">⧉</button><button class="regen-btn" type="button" aria-label="تولید دوباره">↻</button></div>' : ''}`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop=messagesEl.scrollHeight;

  if(animate && role==="assistant"){
    const bubble=row.querySelector(".bubble");
    bubble.classList.add("answer-in");
  }
}
function save(){chats[currentChat].messages=messages;localStorage.setItem("mikazi_chats",JSON.stringify(chats));}

async function checkSession(){
  try{
    const r=await fetch("/api/session");
    const d=await r.json();
    if(d.authenticated){show(home);}
    else show(login);
  }catch{show(login);}
}
loginBtn.addEventListener("click", loginNow);
password.addEventListener("keydown",e=>{if(e.key==="Enter")loginNow();});
$("#togglePass").addEventListener("click",()=>password.type=password.type==="password"?"text":"password");

async function loginNow(){
  loginError.textContent="";
  loginBtn.disabled=true;
  try{
    const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:password.value})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"ورود ناموفق بود.");
    password.value="";
    show(home);
      window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0;
  }catch(e){loginError.textContent=e.message;}
  finally{loginBtn.disabled=false;}
}

$("#logoutBtn").onclick=async()=>{
  await fetch("/api/logout",{method:"POST"});
  show(login);
};

$("#startChat").onclick=()=>{show(chat);renderMessages();input.focus();};
$("#backHome").onclick=()=>show(home);
$("#clearChat").onclick=()=>{
  if(confirm("گفتگو پاک شود؟")){
    messages=[];
    save();
    renderMessages();
  }
};

document.querySelectorAll(".suggestions button").forEach(b=>b.onclick=()=>{
  input.value=b.textContent;
  input.focus();
  input.dispatchEvent(new Event("input"));
});

input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,140)+"px";});
input.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit();}
});

$("#chatForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const text=input.value.trim();
  if(text && chats[currentChat] && chats[currentChat].title==="گفتگوی جدید"){chats[currentChat].title=text.slice(0,32);save();}
  if(!text||sendBtn.disabled)return;
  mikSound("send"); messages.push({role:"user",content:text});
  save();
  addMessage("user",text);
  input.value=""; input.style.height="auto";
  sendBtn.disabled=true; stopBtn.hidden=false;
  const typing=document.createElement("div");
  typing.className="message assistant";
  typing.innerHTML='<div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
  messagesEl.appendChild(typing); messagesEl.scrollTop=messagesEl.scrollHeight;
  try{
    chatController=new AbortController(); const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,memory:mikMemory,personality:mikPersonality}),signal:chatController.signal});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"خطا");
    typing.remove();
    messages.push({role:"assistant",content:d.reply});
    save();
    addMessage("assistant",d.reply);
    mikSound("receive");
  }catch(err){ if(err.name==="AbortError") return;
    typing.remove();
    addMessage("assistant","⚠️ "+err.message);
  }finally{sendBtn.disabled=false;stopBtn.hidden=true;chatController=null;input.focus();}
});

const chatSearch = $("#chatSearch");
const clearSearch = $("#clearSearch");

function filterMessages(){
  const q=(chatSearch?.value||"").trim().toLowerCase();
  document.querySelectorAll("#messages .message").forEach(row=>{
    row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

chatSearch?.addEventListener("input",filterMessages);
clearSearch?.addEventListener("click",()=>{
  if(chatSearch){
    chatSearch.value="";
    filterMessages();
    chatSearch.focus();
  }
});

document.addEventListener("click",e=>{
  const btn=e.target.closest(".copy-btn");
  if(!btn)return;
  const bubble=btn.parentElement.querySelector(".bubble");
  if(!bubble)return;
  navigator.clipboard?.writeText(bubble.textContent).then(()=>{
    const old=btn.textContent;
    btn.textContent="✓";
    btn.classList.add("copied");
    setTimeout(()=>{
      btn.textContent=old;
      btn.classList.remove("copied");
    },1200);
  }).catch(()=>{});
});

checkSession();

function mikSound(type){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value=type==="send"?520:760;
    osc.type="sine";

    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.06,ctx.currentTime+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.18);

    osc.start();
    osc.stop(ctx.currentTime+.13);
  }catch{}
}


const micBtn = $("#micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (micBtn && SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "fa-IR";
  recognition.interimResults = false;
  recognition.continuous = false;

  micBtn.onclick = () => {
    recognition.start();
    micBtn.textContent = "🎙️"; micBtn.classList.remove("recording"); micBtn.classList.add("recording");
  };

  recognition.onresult = e => {
    input.value = e.results[0][0].transcript;
    input.dispatchEvent(new Event("input"));
  };

  recognition.onend = () => {
    micBtn.textContent = "🎙️"; micBtn.classList.remove("recording");
  };
} else if (micBtn) {
  micBtn.onclick = () => alert("مرورگر شما از تشخیص گفتار پشتیبانی نمی‌کند.");
}


function mikSpeak(text){
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fa-IR";
  u.rate = 0.95;
  u.pitch = 1;
  u.volume = 1;

  speechSynthesis.speak(u);
}




sendBtn.addEventListener("click",()=>{
  if(!sendBtn.disabled && input.value.trim()){
    mikSound("send");
  }
});

const historyBtn=$("#historyBtn");
const historyPanel=$("#historyPanel");
const closeHistory=$("#closeHistory");
const historyList=$("#historyList");
const newChatBtn=$("#newChatBtn");

function renderHistory(){
  if(!historyList)return;
  historyList.innerHTML="";
  Object.entries(chats).forEach(([id,c])=>{
    const item=document.createElement("button");
    item.className="history-item";
    item.innerHTML="<strong>"+escapeHtml(c.title||"گفتگوی جدید")+"</strong><small>"+c.messages.length+" پیام</small>";
    item.onclick=()=>{
      currentChat=id;
      messages=chats[id].messages;
      renderMessages();
      historyPanel.classList.add("hidden");
    };
    historyList.appendChild(item);
  });
}

historyBtn?.addEventListener("click",()=>{
  renderHistory();
  historyPanel.classList.remove("hidden");
});

closeHistory?.addEventListener("click",()=>{
  historyPanel.classList.add("hidden");
});

newChatBtn?.addEventListener("click",()=>{
  const id="chat_"+Date.now();
  chats[id]={title:"گفتگوی جدید",messages:[]};
  currentChat=id;
  messages=chats[id].messages;
  save();
  renderMessages();
  renderHistory();
});

function formatMarkdown(s){
  return escapeHtml(s)
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/`([^`]+)`/g,"<code>$1</code>")
    .replace(/\n/g,"<br>");
}

document.addEventListener("click",async e=>{
  const btn=e.target.closest(".regen-btn");
  if(!btn)return;
  const row=btn.closest(".message.assistant");
  const all=[...messagesEl.querySelectorAll(".message.assistant")];
  const n=all.indexOf(row);
  const data=messages.filter(m=>m.role==="assistant")[n];
  if(!data)return;
  btn.disabled=true;
  chatController=new AbortController(); const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:messages.slice(0,messages.indexOf(data))})});
  const d=await r.json();
  if(d.reply){
    data.content=d.reply;
    save();
    renderMessages();
  }
  btn.disabled=false;
});

const memoryBtn=$("#memoryBtn");
const memoryPanel=$("#memoryPanel");
const closeMemory=$("#closeMemory");
const memoryList=$("#memoryList");
const addMemory=$("#addMemory");

let mikMemory=JSON.parse(localStorage.getItem("mikazi_memory")||"[]");

function saveMemory(){
  localStorage.setItem("mikazi_memory",JSON.stringify(mikMemory));
}

function renderMemory(){
  if(!memoryList)return;
  memoryList.innerHTML="";
  mikMemory.forEach((m,i)=>{
    const item=document.createElement("div");
    item.className="memory-item";

    const span=document.createElement("span");
    span.textContent=m;

    const btn=document.createElement("button");
    btn.type="button";
    btn.textContent="حذف";
    btn.onclick=()=>{
      mikMemory.splice(i,1);
      saveMemory();
      renderMemory();
    };

    item.append(span,document.createElement("br"),btn);
    memoryList.appendChild(item);
  });
}

memoryBtn?.addEventListener("click",()=>{
  renderMemory();
  memoryPanel?.classList.remove("hidden");
});

closeMemory?.addEventListener("click",()=>{
  memoryPanel?.classList.add("hidden");
});

addMemory?.addEventListener("click",()=>{
  const v=prompt("چی رو می‌خوای MIKAZI به خاطر بسپره؟");
  if(v?.trim()){
    mikMemory.push(v.trim());
    saveMemory();
    renderMemory();
  }
});



const stopBtn=$("#stopBtn");

stopBtn?.addEventListener("click",()=>{
  if(chatController){
    chatController.abort();
    chatController=null;
  }

  const typing=document.querySelector("#messages .message.assistant:last-child .typing");
  if(typing){
    typing.closest(".message")?.remove();
  }

  sendBtn.disabled=false;
  stopBtn.hidden=true;
  input.focus();
});

const settingsBtn=$("#settingsBtn");
const settingsPanel=$("#settingsPanel");
const closeSettings=$("#closeSettings");

settingsBtn?.addEventListener("click",()=>{
  settingsPanel?.classList.remove("hidden");
});

closeSettings?.addEventListener("click",()=>{
  settingsPanel?.classList.add("hidden");
});

const personalitySelect=$("#personalitySelect");

let mikPersonality=localStorage.getItem("mikazi_personality")||"normal";

if(personalitySelect){
  personalitySelect.value=mikPersonality;

  personalitySelect.addEventListener("change",()=>{
    mikPersonality=personalitySelect.value;
    localStorage.setItem("mikazi_personality",mikPersonality);
  });
}
