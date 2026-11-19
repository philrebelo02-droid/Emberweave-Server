"""Apply the reviewed v1424 art/language brief to the v1423 checkout."""
import json,re,hashlib,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
page=ROOT/'emberweave-heroes.html';html=page.read_bytes().decode('utf-8');NL='\r\n' if '\r\n' in html else '\n'
def replace(old,new,count=1):
    global html
    assert html.count(old)==count,(old[:90],html.count(old),count)
    html=html.replace(old,new)
replace("mh.classList.toggle('merc-title-art',typeof LANG!=='undefined'&&LANG.cur==='en')","mh.classList.add('merc-title-art')",2)
replace("acHeading.classList.toggle('ac-title-art',LANG.cur==='en')","acHeading.classList.add('ac-title-art')")
replace('#rankings .bb-title-art{display:none;','#rankings .bb-title-art{display:block;')
replace('html:lang(en) #rankings .bb-title-art{display:block}'+NL,'')
replace('html:lang(en) #rankings .bb-title-text{','#rankings .bb-title-text{')
replace('.hd-rarb{width:100%;max-width:190px;', '.hd-rarb{position:relative;width:100%;max-width:190px;aspect-ratio:5/2;')
replace('.hd-rarb-label{display:grid;place-items:center;aspect-ratio:5/2;text-align:center;line-height:1.15;font-weight:800;color:#f4deab}',
 '.hd-rarb-label{position:absolute;left:50%;top:51%;transform:translate(-50%,-50%);width:62%;text-align:center;white-space:nowrap;line-height:1.2;font:900 20px/1.2 Georgia,serif;letter-spacing:.02em;text-transform:uppercase;color:#ffe4a0;background:linear-gradient(#fff7d1 10%,#f7d57c 48%,#bd7a29 72%,#ffe5a0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:.25px #6d3514;filter:drop-shadow(0 1px 1px #301207)}')
old="  const rarBanner = LANG.cur!=='en' ? `<div class=\"hd-rarb rb-${_rar}\"><span class=\"hd-rarb-label\">${rarityLabel}</span></div>` : RARITY_READY ? `<div class=\"hd-rarb rb-${_rar}\"><img src=\"/assets/img/banners/${_rar}-word.webp?v=${RARITY_V}\" width=\"1000\" height=\"400\" alt=\"${rarityLabel}\"></div>` : mythBanner;"
new='  const rarBanner = `<div class="hd-rarb rb-${_rar}"><img src="/assets/img/banners/${_rar}.webp?v=${RARITY_V}" width="1000" height="400" alt=""><span class="hd-rarb-label">${rarityLabel}</span></div>`;'
replace(old,new)
replace("  const img=`/assets/img/banners/${r}${o.word?'-word':''}.webp?v=${RARITY_V}`;","  const img=`/assets/img/banners/${r}.webp?v=${RARITY_V}`;")
replace("${o.word?'':`<span>${escapeHTML(nm)}</span>`}","<span>${escapeHTML(o.word?ewT('herolist.rarity_'+r):nm)}</span>")
helper='''// One blank rarity banner and painted translated label in every locale.
let EW_RARITY_RO, EW_RARITY_TARGET;
function fitRarityBanners(root){
  root=root||document;
  root.querySelectorAll('.hd-rarb-label').forEach(label=>{
    if(!label.clientWidth) return;
    let size=20; label.style.fontSize=size+'px';
    while(size>8 && label.scrollWidth>label.clientWidth){size-=.5;label.style.fontSize=size+'px';}
    if(typeof ResizeObserver!=='undefined'){
      if(!EW_RARITY_RO) EW_RARITY_RO=new ResizeObserver(entries=>entries.forEach(e=>fitRarityBanners(e.target)));
      if(EW_RARITY_TARGET!==label.parentElement){EW_RARITY_RO.disconnect();EW_RARITY_TARGET=label.parentElement;EW_RARITY_RO.observe(EW_RARITY_TARGET);}
    }
  });
}
document.fonts&&document.fonts.ready.then(()=>fitRarityBanners());
'''.replace('\n',NL)
replace('function heroIcon(key,px,opts){',helper+'function heroIcon(key,px,opts){')
pattern=r'(  body\.innerHTML=`\$\{summonBar\}<div class="hd-wrap">[^\r\n]+;)' 
html,hits=re.subn(pattern,lambda m:m[1]+NL+'  requestAnimationFrame(()=>fitRarityBanners(body));',html);assert hits==1,hits
tiers=[('champion',1,'1','#ffe9b8'),('warlord',2,'2','#f6b483'),('conqueror',3,'3','#dab5ff'),('master',10,'4–10','#99e2b3'),('diamond',25,'11–25','#9fe8ff'),('platinum',50,'26–50','#bfe6ed'),('gold',100,'51–100','#ffd45e'),('silver',500,'101–500','#d6dfec'),('iron',1000,'501–1000','#abb1b9'),('bronze',None,'1001+','#dfa273')]
league='const ARENA_LEAGUES='+json.dumps([{'id':key,'max':maximum,'range':span,'col':colour,'labelKey':'arena.league_'+key} for key,maximum,span,colour in tiers],ensure_ascii=False,separators=(',',':'))+';'+NL+'''function arenaLeague(rank){
  const value=Number(rank), r=Number.isFinite(value)?Math.max(1,Math.floor(value)):1001;
  const league=ARENA_LEAGUES.find(entry=>entry.max===null||r<=entry.max);
  return {...league,name:t(league.labelKey),art:'/assets/img/ui/arena-leagues/'+league.id+'.webp?v=1424'};
}'''.replace('\n',NL)
html,hits=re.subn(r'function arenaLeague\(rank\)\{[\s\S]*?\}; \}',lambda _:league,html,count=1);assert hits==1
replace('<img class="arMedalArt" src="${lg.art}" alt="">','<img class="arMedalArt" src="${lg.art}" alt="${escapeHTML(lg.name)}" title="${escapeHTML(lg.name)} · #${lg.range}">')
replace('<div class="arLeague" style="color:${lg.col}">${lg.name}</div>','<div class="arLeague" style="color:${lg.col}">${lg.name}<small style="display:block;font:11px/1.3 inherit;letter-spacing:0">#${lg.range}</small></div>')
html=html.replace("every hero's detail view shows its WORDED rarity banner (COMMON / UNCOMMON / RARE / MYTHICAL) under the portrait", "every hero's detail view shows its blank rarity banner with a translated label under the portrait")
new_keys=['arena.league_warlord','arena.league_conqueror','arena.league_platinum','arena.league_iron']
names={
'en':['Warlord','Conqueror','Platinum','Iron'],'es':['Señor de la guerra','Conquistador','Platino','Hierro'],'pt-BR':['Senhor da guerra','Conquistador','Platina','Ferro'],'fr':['Seigneur de guerre','Conquérant','Platine','Fer'],'de':['Kriegsherr','Eroberer','Platin','Eisen'],'it':['Signore della guerra','Conquistatore','Platino','Ferro'],'nl':['Krijgsheer','Veroveraar','Platina','IJzer'],'ru':['Воевода','Завоеватель','Платина','Железо'],'tr':['Savaş beyi','Fatih','Platin','Demir'],'ja':['武将','征服者','プラチナ','鉄'],'ko':['전쟁군주','정복자','플래티넘','철'],'zh-Hans':['战争领主','征服者','铂金','铁'],'zh-Hant':['戰爭領主','征服者','鉑金','鐵'],'th':['จอมขุนศึก','ผู้พิชิต','แพลทินัม','เหล็ก'],'id':['Panglima perang','Penakluk','Platina','Besi'],'hi':['युद्धनायक','विजेता','प्लैटिनम','लोहा']}
patch_title='Consistent art and Arena leagues'
patch_lines=['Building title artwork is now the same in every language. Hero rarity banners keep their artwork and translate the label.','The Arena now has ten league symbols and translated names, covering rank 1 through rank 1001+.']
localized={
'es':['Arte uniforme y ligas de la Arena','Los títulos de los edificios conservan el mismo diseño en todos los idiomas. Los estandartes de rareza de los héroes mantienen su diseño y traducen el texto.','La Arena tiene ahora diez símbolos de liga y nombres traducidos, desde el puesto {0} hasta el {1}+.'],
'pt-BR':['Arte consistente e ligas da Arena','Os títulos dos edifícios agora mantêm a mesma arte em todos os idiomas. As faixas de raridade dos heróis mantêm a arte e traduzem o texto.','A Arena agora tem dez símbolos de liga e nomes traduzidos, do posto {0} ao {1}+.'],
'fr':['Visuels cohérents et ligues de l’Arène','Les titres des bâtiments conservent désormais le même visuel dans toutes les langues. Les bannières de rareté des héros gardent leur illustration et affichent un texte traduit.','L’Arène dispose désormais de dix emblèmes de ligue et de noms traduits, du rang {0} au rang {1}+.'],
'de':['Einheitliche Grafik und Arenaligen','Die Titelgrafiken der Gebäude bleiben jetzt in jeder Sprache gleich. Die Seltenheitsbanner der Helden behalten ihre Grafik und zeigen eine übersetzte Beschriftung.','Die Arena hat jetzt zehn Ligensymbole und übersetzte Namen, von Rang {0} bis Rang {1}+.'],
'it':['Grafica uniforme e leghe dell’Arena','I titoli degli edifici mantengono ora la stessa grafica in tutte le lingue. I vessilli della rarità degli eroi mantengono la grafica e mostrano il testo tradotto.','L’Arena ora ha dieci simboli di lega e nomi tradotti, dalla posizione {0} alla {1}+.'],
'nl':['Dezelfde vormgeving en arenacompetities','De titels van gebouwen behouden nu in elke taal dezelfde vormgeving. De zeldzaamheidsvaandels van helden behouden hun afbeelding en tonen vertaalde tekst.','De Arena heeft nu tien competitiesymbolen en vertaalde namen, van rang {0} tot rang {1}+.'],
'ru':['Единое оформление и лиги Арены','Изображения названий зданий теперь одинаковы на всех языках. Знамёна редкости героев сохраняют оформление и показывают переведённую надпись.','На Арене теперь десять символов лиг и переведённые названия — от места {0} до места {1}+.'],
'tr':['Tutarlı görseller ve Arena ligleri','Bina başlıklarının görselleri artık tüm dillerde aynı kalıyor. Kahraman nadirlik sancakları görsellerini koruyor ve çevrilmiş metin gösteriyor.','Arena artık {0}. sıradan {1}+. sıraya kadar on lig simgesi ve çevrilmiş lig adları sunuyor.'],
'ja':['共通のアートとアリーナリーグ','建物のタイトル画像が、すべての言語で同じになりました。英雄のレアリティバナーは画像を維持し、文字だけを翻訳して表示します。','アリーナに、{0}位から{1}位以降までをカバーする10種類のリーグシンボルと翻訳されたリーグ名が登場しました。'],
'ko':['동일한 아트와 아레나 리그','이제 모든 언어에서 건물 제목 이미지가 동일하게 표시됩니다. 영웅 희귀도 배너는 원래 이미지를 유지하고 글자만 번역하여 표시합니다.','아레나에 {0}위부터 {1}위 이상까지 적용되는 리그 상징 10개와 번역된 리그 이름이 추가되었습니다.'],
'zh-Hans':['统一美术与竞技场联赛','建筑标题图案现已在所有语言中保持一致。英雄稀有度横幅保留原有图案，仅翻译文字。','竞技场现有十种联赛徽记及翻译后的联赛名称，涵盖第{0}名至第{1}名及之后的排名。'],
'zh-Hant':['統一美術與競技場聯賽','建築標題圖案現已在所有語言中保持一致。英雄稀有度橫幅保留原有圖案，僅翻譯文字。','競技場現有十種聯賽徽記及翻譯後的聯賽名稱，涵蓋第{0}名至第{1}名及之後的排名。'],
'th':['ภาพที่สอดคล้องกันและลีกอารีนา','ภาพชื่ออาคารจะแสดงเหมือนกันในทุกภาษาแล้ว แบนเนอร์ระดับความหายากของฮีโร่ยังใช้ภาพเดิมและแสดงข้อความที่แปลแล้ว','อารีนามีสัญลักษณ์ลีกสิบแบบและชื่อที่แปลแล้ว ครอบคลุมตั้งแต่อันดับ {0} ถึงอันดับ {1}+'],
'id':['Tampilan seragam dan liga Arena','Gambar judul bangunan kini sama dalam semua bahasa. Spanduk kelangkaan hero tetap memakai gambar yang sama dengan teks yang diterjemahkan.','Arena kini memiliki sepuluh lambang liga dan nama terjemahan, mulai dari peringkat {0} hingga {1}+.'],
'hi':['एक जैसी कला और एरीना लीग','अब हर भाषा में इमारतों के शीर्षक की कला एक जैसी रहती है। हीरो की दुर्लभता के बैनर वही कला रखते हैं और उन पर लिखा पाठ अनुवादित होता है।','एरीना में अब रैंक {0} से रैंक {1}+ तक के लिए दस लीग चिह्न और अनुवादित नाम हैं।']}
def compact(obj):return json.dumps(obj,ensure_ascii=False,separators=(',',':'))
def tpl(s):
    n=0
    def sub(m):
        nonlocal n
        if m[0][0] in '{<&':return m[0]
        value='{'+str(n)+'}';n+=1;return value
    return re.sub(r'\{[^{}]*\}|<[^>]*>|&#?\w+;|\d+(?:\.\d+)?',sub,s)
version={};content_versions={}
for code,values in names.items():
    path=ROOT/'lang'/f'{code}.json';d=json.loads(path.read_text(encoding='utf-8'));added=dict(zip(new_keys,values));d.update(added);text=compact(dict(sorted(d.items())));path.write_text(text,encoding='utf-8');version[code]=hashlib.sha1(text.encode()).hexdigest()[:8]
    if code!='en':
        path=ROOT/'tools/lang/tr'/code/'V1424_art_leagues.json';path.parent.mkdir(exist_ok=True,parents=True);path.write_text(json.dumps(added,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        path=ROOT/'lang'/f'{code}.content.json';d=json.loads(path.read_text(encoding='utf-8'));note=dict(zip([patch_title,*map(tpl,patch_lines)],localized[code]));d.update(note);text=compact(dict(sorted(d.items())));path.write_text(text,encoding='utf-8');content_versions[code]=hashlib.sha1(text.encode()).hexdigest()[:8]
        source=ROOT/'tools/lang/content'/code/'V1424_patch_notes.json';source.parent.mkdir(exist_ok=True,parents=True);source.write_text(json.dumps(note,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
spec={'keys':dict(zip(new_keys,names['en'])),'edits':[]};(ROOT/'tools/lang/specs/V1424_art_leagues.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
source=ROOT/'tools/lang/content/en.json';d=json.loads(source.read_text(encoding='utf-8'));d.update({k:'patch_notes' for k in [patch_title,*map(tpl,patch_lines)]});source.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
en=json.loads((ROOT/'lang/en.json').read_text(encoding='utf-8'))
html,hits=re.subn(r'(const EW_LANG_EN=)\{[^\r\n]*\};',lambda m:m[1]+compact(en)+';',html,count=1);assert hits==1
for key,updated in [('EW_LANG_V',version),('EW_LANG_CV',content_versions)]:
    found=re.search(r'const '+key+r'=(\{[^\r\n]*\});',html);assert found
    d=json.loads(found[1]);d.update(updated);html=html[:found.start(1)]+compact(d)+html[found.end(1):]
feed=ROOT/'patchnotes.json';d=json.loads(feed.read_text(encoding='utf-8'));assert d['patches'][0]['ver']=='1.9.4';d['patches'].insert(0,{'ver':'1.9.5','date':'19 November 2026','title':patch_title,'items':patch_lines});feed.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sources=ROOT/'patchnotes-sources.json';d=json.loads(sources.read_text(encoding='utf-8'));d['patches'].insert(0,{'ver':'1.9.5','releases':'v1424','items':[{'text':'Phil / ART SAME IN EVERY LANGUAGE 19NOV2026 corrected brief: identical English building logos, existing blank translated rarity banners, ten Arena league symbols and translated names. Draft for Claude review; not deployed.'}]});sources.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
build=str(int(time.time()*1000));html,hits=re.subn(r"const BUILD_ID = '\d+';","const BUILD_ID = '"+build+"';",html);assert hits==1;page.write_bytes(html.encode('utf-8'));(ROOT/'version.json').write_text(compact({'build':build}),encoding='utf-8')
print('Applied v1424 logos, rarity banners,10league mappings,16UI dictionaries and15patch translations; build',build)
