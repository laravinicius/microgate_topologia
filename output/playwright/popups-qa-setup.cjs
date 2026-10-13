const { chromium } = require('C:/Users/Vinicius/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
module.exports = async function setup() {
 const q = {errors:[],native:[],writes:[],checks:[],unhandled:[],failNext:null,delayNext:0,seq:100,admin:true};
 q.fixture={
 empresas:[{id:1,nome:'QA InfraMap'},{id:2,nome:'QA Filial'}],andares:[{id:1,nome:'QA Andar'}],
 racks:[{id:1,nome:'Rack QA',patchPanels:[{id:1,nome:'Panel QA',portas:24}]}],
 mesas:[{id:1,nome:'Mesa QA',andarId:1,andarNome:'QA Andar',pontos:[{id:1,rackId:1,patchId:1,porta:1,atencao:false},{id:2,rackId:null,patchId:null,porta:null,atencao:false}]}],
 elements:[{id:11,tipo:'mesa',nome:'Mesa QA',andarId:1,x:200,y:200,largura:60,altura:180,cor:'#3f3f3f',rotacao:0,font_size:12,dados_json:{mesaId:1}},
 {id:12,tipo:'rack',nome:'Rack QA',andarId:1,x:400,y:200,largura:80,altura:200,cor:'#2563eb',rotacao:0,font_size:12,dados_json:{rackId:1}}],
 users:[{id:1,username:'qa-admin',is_admin:true,is_active:true,empresas:[]},{id:2,username:'qa-viewer',is_admin:false,is_active:true,empresas:[{id:1,nome:'QA InfraMap'}]}]};
 const copy=x=>JSON.parse(JSON.stringify(x));
 q.browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 q.context=await q.browser.newContext({viewport:{width:1440,height:1000}});
 q.context.setDefaultTimeout(5000);
 q.attach=async context=>{
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),body=req.postDataJSON()||{},f=q.fixture;
   if(path==='/api/sse')return route.fulfill({contentType:'text/event-stream',body:': qa\n\n'});
   let result={success:true};
   if(method!=='GET'){
    q.writes.push({path,method,body:copy(body)});
    if(q.delayNext){const delay=q.delayNext;q.delayNext=0;await new Promise(r=>setTimeout(r,delay));}
    if(q.failNext===path){q.failNext=null;return route.fulfill({status:400,json:{success:false,message:'Falha simulada de gravação'}});}
   }
   if(path==='/api/auth/me')result={authenticated:true,username:q.admin?'qa-admin':'qa-viewer',isAdmin:q.admin};
   else if(path==='/api/auth/login')result={success:true,token:'qa-token',username:'qa-admin',isAdmin:q.admin};
   else if(path==='/api/auth/select-company')result={success:true,empresaId:body.empresaId,empresaNome:f.empresas.find(e=>e.id===body.empresaId)?.nome,token:'qa-token'};
   else if(path==='/api/auth/select-andar')result={success:true,andarId:body.andarId,andarNome:f.andares.find(e=>e.id===body.andarId)?.nome,token:'qa-token'};
   else if(path==='/api/auth/logout'){}
   else if(path==='/api/empresas'){if(method==='POST')f.empresas.push({id:++q.seq,nome:body.nome});result={success:true,empresas:copy(f.empresas)};}
   else if(/^\/api\/empresas\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));if(method==='PUT')f.empresas.find(e=>e.id===id).nome=body.nome;else f.empresas=f.empresas.filter(e=>e.id!==id);}
   else if(path==='/api/andares'){if(method==='POST')f.andares.push({id:++q.seq,nome:body.nome});result={success:true,andares:copy(f.andares)};}
   else if(/^\/api\/andares\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));if(method==='PUT')f.andares.find(e=>e.id===id).nome=body.nome;else f.andares=f.andares.filter(e=>e.id!==id);}
   else if(path==='/api/racks'){if(method==='POST'){const rack={id:++q.seq,nome:body.nome,patchPanels:[]};f.racks.push(rack);result={success:true,rack:copy(rack)};}else{if(method==='PUT')f.racks=copy(body.racks);result={success:true,racks:copy(f.racks),mesas:copy(f.mesas)};}}
   else if(/^\/api\/racks\/\d+$/.test(path))f.racks.find(e=>e.id===Number(path.split('/').at(-1))).nome=body.nome;
   else if(path==='/api/users'){if(method==='POST')f.users.push({id:++q.seq,username:body.username,is_admin:body.is_admin,is_active:true,empresas:f.empresas.filter(e=>body.empresaIds.includes(e.id))});result={success:true,users:copy(f.users)};}
   else if(/^\/api\/users\/\d+$/.test(path)){const user=f.users.find(e=>e.id===Number(path.split('/').at(-1)));if(user.id===1&&(body.is_admin===false||body.is_active===false))result={success:false,message:'Você não pode alterar o próprio acesso'};else{if(body.is_admin!==undefined)user.is_admin=body.is_admin;if(body.is_active!==undefined)user.is_active=body.is_active;if(body.empresaIds)user.empresas=f.empresas.filter(e=>body.empresaIds.includes(e.id));}}
   else if(path==='/api/data'){if(method==='PUT')f.mesas=copy(body.mesas);result={success:true,mesas:copy(f.mesas),racks:copy(f.racks),allMesas:copy(f.mesas)};}
   else if(/^\/api\/mesas\/\d+$/.test(path))f.mesas.find(m=>m.id===Number(path.split('/').at(-1))).nome=body.nome;
   else if(path==='/api/ponto/toggle-atencao'){const p=f.mesas.flatMap(m=>m.pontos).find(p=>p.rackId===body.rackId&&p.patchId===body.patchId&&p.porta===body.porta);p.atencao=!p.atencao;}
   else if(path==='/api/map-elements')result={success:true,elements:copy(f.elements)};
   else if(path==='/api/map-elements/bulk')f.elements=copy(body.elements);
   else if(path==='/api/qrcode/all-mesas')result={success:true,mesas:copy(f.mesas)};
   else if(path==='/api/rack-connections'||path==='/api/public/rack-connections')result={success:true,connections:[{porta:1,mesaNome:'Mesa QA',andarNome:'QA Andar',pontoId:1,atencao:false}]};
   else if(path==='/api/public/empresa')result={success:true,empresa:{nome:'QA InfraMap'}};
   else if(path==='/api/public/andares')result={success:true,andares:copy(f.andares)};
   else if(path==='/api/public/map-elements')result={success:true,elements:copy(f.elements)};
   else if(path==='/api/public/racks')result={success:true,racks:copy(f.racks),mesas:copy(f.mesas)};
   else{q.unhandled.push({path,method});result={success:false,message:'Endpoint não simulado'};}
   await route.fulfill({json:result});
  });
  await context.route('**/img/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><rect width="100" height="30" fill="#333"/></svg>'}));
  await context.addInitScript(()=>sessionStorage.setItem('inframap-auth-token','qa-token'));
 };
 await q.attach(q.context);
 q.page=await q.context.newPage();
 q.page.on('pageerror',e=>q.errors.push(e.message));
 q.page.on('dialog',async d=>{q.native.push(d.type());await d.dismiss();});
 q.dlg=()=>q.page.locator('.system-modal-host:not([inert]) [role="dialog"]');
 q.closed=()=>q.page.locator('[role="dialog"]').waitFor({state:'detached'});
 q.assert=(ok,message)=>{if(!ok)throw Error(message);q.checks.push(message);};
 await q.page.goto('http://127.0.0.1:5189/');
 await q.page.getByRole('button',{name:'+ Nova Empresa',exact:true}).waitFor();
 return q;
};
