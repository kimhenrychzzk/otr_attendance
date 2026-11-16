'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = Number(process.env.PORT || 3000);
const DB = process.env.DATA_FILE || path.join(__dirname, 'attendance.json');
const ROOM_RULES = process.env.OTR_RULES || '📌 OFF THE RECORD 운영 규칙\n1. 서로 존중하고 예의를 지켜주세요.\n2. 광고·도배·개인정보 공개는 삼가주세요.\n3. 모임 참여 전 공지사항을 확인해 주세요.\n※ 실제 방 규칙에 맞게 관리자가 수정해 주세요.';
let db = {users:{}};
try { db = JSON.parse(fs.readFileSync(DB,'utf8')); if(!db.users) db.users={}; } catch(e) { if(e.code!=='ENOENT') throw e; }
function persist(){const tmp=DB+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB);}
function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function prevDay(key){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function reply(text){return {version:'2.0',template:{outputs:[{simpleText:{text:text.slice(0,1000)}}]}};}
function label(u){return (u.nickname || '회원').slice(0,30);}
function rank(){return Object.entries(db.users).sort((a,b)=>b[1].total-a[1].total || (a[1].last||'').localeCompare(b[1].last||'')).map(([id,u],i)=>({id,u,rank:i+1}));}
function handle(body){const action=(body.action?.params?.command || body.action?.name || body.userRequest?.utterance || '').trim().replace(/^\//,'').replace(/\s+/g,'');
 const user=body.userRequest?.user || {};
 // Kakao channel user id is scoped to the bot/channel; never use nickname as the identity key.
 const uid=user.id || body.userRequest?.user?.properties?.botUserKey;
 const nick=(user.properties?.nickname || user.properties?.botUserKey || '회원').slice(0,30);
 if(['출석','내출석'].includes(action) && !uid) return reply('사용자를 확인할 수 없어. 채널 연결 및 사용자 식별 정보를 확인해 줘.');
 if(action==='출석'){
   const today=dayKey(); const u=db.users[uid] || {nickname:nick,total:0,streak:0,last:null};u.nickname=nick;
   if(u.last===today)return reply(`🖤 ${label(u)}님, 오늘은 이미 출석했어!\n📅 누적 ${u.total}일 · 🔥 연속 ${u.streak}일`);
   u.streak=u.last===prevDay(today)?u.streak+1:1;u.total++;u.last=today;db.users[uid]=u;persist();
   const position=rank().find(x=>x.id===uid)?.rank;
   return reply(`🖤 ${label(u)}님 출석 완료!\n📅 누적 출석: ${u.total}일\n🔥 연속 출석: ${u.streak}일\n🏆 현재 순위: ${position}위`);
 }
 if(action==='내출석'){const u=db.users[uid];return reply(u?`🙋 ${label(u)}님 출석 기록\n📅 누적 ${u.total}일\n🔥 연속 ${u.last===dayKey()?u.streak:u.last===prevDay(dayKey())?u.streak:0}일\n마지막 출석: ${u.last}`:'아직 출석 기록이 없어! /출석 으로 시작해 줘 🖤');}
 if(action==='출석순위'){const entries=rank().slice(0,10);return reply(entries.length?'🏆 OTR 출석순위 TOP 10\n'+entries.map((x,i)=>`${i+1}위 ${label(x.u)} — ${x.u.total}일`).join('\n'):'아직 출석 기록이 없어!');}
 if(action==='출석부'){const entries=Object.values(db.users).filter(u=>u.last===dayKey());return reply(`📋 오늘의 출석부 (${entries.length}명)\n`+(entries.length?entries.slice(0,25).map(u=>'• '+label(u)).join('\n'):'아직 출석한 회원이 없어.'));}
 if(action==='벙만들기'||action==='벙만들기양식')return reply('🎉 OTR 벙개 모집 양식\n📍 장소:\n📅 날짜:\n⏰ 시간:\n🍻 활동 내용:\n👥 모집 인원:\n💰 예상 비용:\n🙋 주최자:\n\n복사해서 채팅방에 올려줘! 🖤');
 if(action==='규칙')return reply(ROOM_RULES);
 return reply('🤖 OTR MANAGER 명령어\n/출석 /내출석 /출석순위 /출석부\n/벙만들기 /규칙');
}
const server=http.createServer((req,res)=>{if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok');}
if(req.method!=='POST'||req.url!=='/skill'){res.writeHead(404);return res.end('Not found');}
let raw='';req.on('data',c=>{raw+=c;if(raw.length>1024*1024)req.destroy();});req.on('end',()=>{try{const output=handle(JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(output));}catch(e){console.error(e);res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify(reply('요청 처리 중 오류가 발생했어.')));}});
});server.listen(PORT,()=>console.log(`OTR MANAGER listening on ${PORT}`));
