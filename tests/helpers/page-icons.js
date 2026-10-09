// v1098: the page's icon helpers (uiIcon / hudIcon / statusIcon / iconize / stripIcons) for tests that run page
// functions in a vm. Taken from the page itself; a control page without them (an older build) falls back to the current one.
const fs=require('fs'), path=require('path'), vm=require('vm');
module.exports=function pageIcons(html){
  const own=path.join(__dirname,'..','..','emberweave-heroes.html');
  if(!html || html.indexOf('const ICON_SRC=')<0) html=fs.readFileSync(own,'utf8');
  const a=html.indexOf('const ICON_SRC='), b=html.indexOf('function stripIcons',a), e=html.indexOf('\n',b);
  if(a<0||b<0||e<0) throw new Error('icon helpers not found in the page');
  const c={}; vm.createContext(c);
  vm.runInContext(html.slice(a,e)+';this.out={ICON_SRC,iconImg,uiIcon,hudIcon,statusIcon,iconize,stripIcons};',c);
  return c.out; };
