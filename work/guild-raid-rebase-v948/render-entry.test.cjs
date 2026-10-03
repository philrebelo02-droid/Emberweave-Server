'use strict';const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),a=require('node:assert/strict');
test('actual Raid tab function renders and wires recovery without removed journal symbol',async()=>{
 const file=process.env.RENDER_CONTROL?'../guild-raid-cleanup-recovery-v942/private-bootstrap-heroes.html':'private-client-v948.html',html=fs.readFileSync(path.join(__dirname,file),'utf8');
 const b=html.indexOf('async function renderGuildRaid(el){'),e=html.indexOf('function renderGuildContribute(el)',b);a(b>0&&e>b);const fn=html.slice(b,e);
 const s={recovered:0,buttons:[]},el={innerHTML:'',firstChild:null,querySelector:()=>null,prepend:x=>s.buttons.push(x)};
 const ctx={_raidGen:0,state:'guild',guildTab:'raid',window:{},document:{getElementById:()=>null,createElement:()=>({})},setInterval:()=>1,clearInterval:()=>{},escapeHTML:String,raidRecoverSaved:()=>s.recovered++,api:async()=>({raid:{hp:100,max:100,name:'Fixture',level:1,yourDmg:0,guildDmg:0,kills:0,top:[],attemptsLeft:2}})};
 vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.renderGuildRaid(el);a.match(el.innerHTML,/gbAssault/);a.equal(s.buttons.length,1);a.match(s.buttons[0].textContent,/Recover saved/);s.buttons[0].onclick();a.equal(s.recovered,1);
});
