'use strict';const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const parent=fs.readFileSync(path.join(__dirname,'private-server-start-only.js'));a.equal(hash(parent),'f2a253d669475884ee44dafd5bc8e51a45cc917860d19ba3752f546ebd382c9a');let s=parent.toString(),old='      const r=ensureRaid(guild); r.att=r.att||{};\n      // Private opt-in namespace.';a.equal(s.split(old).length,2);s=s.replace(old,`      const r=ensureRaid(guild);
      if(r.att!==undefined && (!r.att || typeof r.att!=='object' || Array.isArray(r.att)))
        return send(res,409,{ok:false,bossBusy:true,error:'Saved raid attempts require recovery. No new attempt was spent.'});
      r.att=r.att||{};
      // Private opt-in namespace.`);fs.writeFileSync(path.join(__dirname,'private-server-start-shape.js'),s);console.log(JSON.stringify({parentSHA256:hash(parent),sourceSHA256:hash(s),status:'START-ONLY partial, malformed attempt map held; release/damage not implemented'}));
