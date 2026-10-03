'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto');let s=fs.readFileSync(path.join(__dirname,'../guild-raid-locked-stage-v948/integration.cjs'),'utf8');
a.equal(crypto.createHash('sha256').update(s).digest('hex'),'957149ef079e25c3be99b9db04aa3dbbd3f6461f8fa2d07cc555e12cb32dd4a3');
// Wrapper source itself has no fixture ownership; its guarded upstream harness restores the own snapshot.
a(s.includes('6559a3d50837800f46a5593c874895f666b472492ac57fff46d2725d3df14d7f'));s=s.replaceAll('private-client-locked-stage.html','private-client-entry-closure.html').replaceAll('6559a3d50837800f46a5593c874895f666b472492ac57fff46d2725d3df14d7f','c4f330ca4ae0df11f56caa2fab3db6d6483adcaddb0a970c02953ae8516ff115');
const file=path.join(__dirname,'entry-closure-integrated-wrapper.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(s,file);
