'use strict';
// Private boundary only. The facade validates and commits confirmation; this
// adapter cannot take raw API replies and never clears a legacy journal itself.
function create({facade,current,owner,setOwner,pending,render,notice}){
 if(!facade||typeof facade.settle!=='function'||typeof facade.current!=='function')throw Error('Confirmed facade required');
 let busy=false;
 const guard=()=>{if(!current()||!facade.current()||owner()!==pending)throw Error('Stale presentation');};
 async function recover(id){guard();if(busy)throw Error('Recovery already running');busy=true;
  try{const reply=await facade.settle(id);guard();const body=reply?.body;
   if(body?.cleanupOnly===true){
    if(reply.status!==200||Object.keys(body).length!==1)throw Error('Invalid cleanup-only presentation');
    setOwner(null);notice('Saved raid confirmation recovered. No new reward was requested.');
    return {cleanupOnly:true};
   }
   if(reply?.status===200&&body?.ok===false&&body?.expired===true){
    setOwner(null);notice('Saved raid attempt expired. No new fight or reward was requested.');return {expired:true};
   }
   if(reply?.status!==200||body?.ok!==true)throw Error('Confirmed settlement required');
   render(body);return {presented:true};
  }finally{busy=false;}
 }
 return{recover};
}
module.exports={create};
