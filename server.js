// LocalDrop signaling server. Files NEVER pass through here (they go browser-to-browser via WebRTC).
// It only introduces devices on the same network (same public IP) or same room code.
let QR;try{QR=require('qrcode')}catch(e){}
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const fs2=require('fs'),dir=fs2.existsSync(path.join(__dirname,'public','index.html'))?path.join(__dirname,'public'):__dirname;
const ok=/^\/(index\.html|manifest\.json|sw\.js|icon-\d+\.png)$/,types={'.html':'text/html; charset=utf-8','.json':'application/manifest+json','.js':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
  if(u==='/qr.svg'){const t=new URL(q.url,'http://x').searchParams.get('d')||'';
    if(!QR||!t||t.length>300){r.writeHead(404).end();return}
    QR.toString(t,{type:'svg',margin:1,color:{dark:'#000000',light:'#ffffff'}},(e,x)=>{if(e){r.writeHead(500).end();return}r.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400'});r.end(x)});return}
  if(!ok.test(u))return r.writeHead(404).end('Not found');
  fs.readFile(path.join(dir,u),(e,d)=>{if(e)return r.writeHead(404).end('Not found: '+u+' is missing on the server');r.writeHead(200,{'Content-Type':types[path.extname(u)]});r.end(d)})});
const wss=new WebSocketServer({server:srv,path:'/ws'});
const rooms=new Map(),A=['Swift','Calm','Brave','Lucky','Cosmic','Silver'],N=['Fox','Owl','Panda','Otter','Hawk','Tiger'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
function broadcast(room){const list=[...rooms.get(room)||[]].map(c=>({id:c.id,name:c.name,icon:c.icon}));
  for(const c of rooms.get(room)||[])c.send(JSON.stringify({type:'peers',peers:list.filter(p=>p.id!==c.id)}))}
wss.on('connection',(ws,req)=>{
  const u=new URL(req.url,'http://x'),code=(u.searchParams.get('room')||'').trim().toLowerCase().slice(0,32);
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  const room=code?'r:'+code:'ip:'+ip,ua=req.headers['user-agent']||'';
  ws.id=Math.random().toString(36).slice(2,10);ws.name=pick(A)+' '+pick(N);
  ws.icon=/iPhone|iPad/.test(ua)?'📱':/Android/.test(ua)?'📱':/Windows|Macintosh|Linux/.test(ua)?'💻':'🖥️';
  if(!rooms.has(room))rooms.set(room,new Set());rooms.get(room).add(ws);
  ws.send(JSON.stringify({type:'hello',id:ws.id,name:ws.name,room:code||null}));broadcast(room);
  ws.on('message',m=>{let d;try{d=JSON.parse(m)}catch{return}
    if(d.type!=='signal')return;
    for(const c of rooms.get(room))if(c.id===d.to)c.send(JSON.stringify({type:'signal',from:ws.id,data:d.data}))});
  ws.on('close',()=>{rooms.get(room).delete(ws);if(!rooms.get(room).size)rooms.delete(room);else broadcast(room)});
});
srv.listen(process.env.PORT||3000,()=>console.log('LocalDrop running on port '+(process.env.PORT||3000)));
