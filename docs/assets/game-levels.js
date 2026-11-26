/* Coordinates are in world pixels; surface Y is the top edge. */
export const WIDTH = 960, HEIGHT = 540, FLOOR = 472;
const ground = (x, end, kind) => ({ x, y:FLOOR, w:end-x, h:80, kind });
const shelf = (x,y,w,kind,travel=0,speed=1,vertical=false) => ({x,y,w,h:24,kind,travel,speed,vertical});
const block = (x,y,item) => ({x,y,w:42,h:38,kind:'block',item});
const foe = (kind,x,y=FLOOR,range=75) => ({kind,x,y,range});
const trap = (kind,x,w,phase=0) => ({kind,x,y:FLOOR,w,phase});
const row = (x,y,n,step=45,arc=0) => Array.from({length:n},(_,i)=>({x:x+i*step,y:y-Math.sin(i/Math.max(1,n-1)*Math.PI)*arc}));
const stage = (spec) => ({...spec, pages:spec.pages.flat(), solids:[...spec.ground.map(([x,end])=>ground(x,end,spec.floor)),...spec.shelves,...spec.blocks]});
export const levels = [
  stage({name:'办公室突围', area:'开放办公区', chapter:'投标函', note:'先跟着页码练习跳跃。踩中错别字怪，再去校对旗。', floor:'desk', time:105, required:7, bonus:13, width:2400, end:2260,
    ground:[[0,790],[886,1520],[1630,2400]],
    shelves:[shelf(370,382,135,'cabinet'),shelf(1030,385,162,'desk'),shelf(1215,310,148,'cabinet'),shelf(1780,377,145,'desk'),shelf(1975,327,124,'cabinet')],
    blocks:[block(242,326,'coffee'),block(1345,328,'usb'),block(2090,326,'stapler')],
    pages:[row(166,433,4,48),row(395,345,3,42),row(656,433,3),row(765,418,4,43,62),row(1052,348,3),row(1240,277,3),row(1497,415,4,48,60),row(1810,340,3),row(2010,293,2),row(2155,431,2)],
    enemies:[foe('typo',615),foe('typo',1130,385,60),foe('typo',1410,FLOOR,54),foe('typo',1870,FLOOR,78),foe('typo',2160,FLOOR,48)], traps:[trap('spill',944,55),trap('spill',1710,48)],
    signs:[[146,'空格跳跃 · 下落时踩怪'],[272,'从下方顶道具砖'],[710,'漏页坑 · 起跳']]}),
  stage({name:'打印室危机',area:'综合文印室',chapter:'报价文件',note:'踩着复印机移动平台过坑，地上的警示灯亮起时避开卡纸。', floor:'paper',time:110,required:8,bonus:15,width:2710,end:2550,
    ground:[[0,565],[824,1290],[1510,2020],[2136,2710]],
    shelves:[shelf(362,381,140,'printer'),shelf(608,423,116,'mover',64,1.8),shelf(895,371,148,'printer'),shelf(1344,419,112,'mover',48,1.6),shelf(1642,380,161,'paper'),shelf(1840,306,137,'printer'),shelf(2240,377,150,'paper')],
    blocks:[block(252,326,'usb'),block(1090,327,'coffee'),block(2410,326,'stapler')],
    pages:[row(160,431,4,46),row(390,345,3),row(525,411,4,90,35),row(922,335,3),row(1060,431,4),row(1250,413,4,92,38),row(1665,345,3),row(1872,272,3),row(2000,406,4,49,52),row(2272,343,3),row(2440,433,2)],
    enemies:[foe('bug',410),foe('bug',1065),foe('bug',1660),foe('bug',2345)],traps:[trap('jam',958,46,.55),trap('jam',1170,44,1.6),trap('jam',1920,44,2.2),trap('spill',2182,43)], signs:[[446,'移动平台 · 等它靠近'],[855,'留意闪烁的卡纸灯']]}),
  stage({name:'装订区迷宫',area:'装订作业间',chapter:'技术响应',note:'碎纸机碰到即重试；沿两层机器跳台前进，上层更容易攒够资质页码。', floor:'bind',time:115,required:8,bonus:15,width:2800,end:2640,
    ground:[[0,850],[961,1572],[1690,2230],[2338,2800]],
    shelves:[shelf(300,382,152,'bind'),shelf(448,295,142,'cabinet'),shelf(567,379,152,'bind'),shelf(690,291,146,'cabinet'),shelf(780,374,110,'bind'),shelf(912,386,135,'bind'),shelf(1068,307,170,'cabinet'),shelf(1265,374,145,'bind'),shelf(1450,386,108,'bind'),shelf(1580,384,123,'bind'),shelf(1740,382,184,'bind'),shelf(1895,299,143,'cabinet'),shelf(2070,376,127,'bind'),shelf(2360,380,155,'bind')],
    blocks:[block(228,326,'coffee'),block(1190,326,'stapler'),block(2490,326,'usb')],
    pages:[row(130,430,4),row(325,346,3),row(472,260,3),row(593,344,3),row(710,255,3),row(804,338,5),row(1092,272,3),row(1288,337,3),row(1450,350,6,49,22),row(1764,346,3),row(1920,263,3),row(2090,340,3),row(2206,410,4,49,59),row(2420,344,2),row(2540,431,2)],
    enemies:[foe('bug',748,FLOOR,53),foe('typo',1160,307,51),foe('bug',1350,FLOOR,55),foe('typo',1860,382,55),foe('bug',2470,FLOOR,65)], traps:[trap('shred',480,84),trap('shred',1110,86),trap('shred',1935,83)], signs:[[305,'碎纸机即死 · 请走上层'],[1265,'上层多页码 · 下层也可通行']]}),
  stage({name:'密封室暗战', area:'保密封装室',chapter:'资质证明',note:'应急灯会变暗。幽灵跟得很紧，用订书机把它击退。', floor:'archive',time:105,required:8,bonus:14,width:2690,end:2530,
    ground:[[0,800],[901,1480],[1596,2110],[2220,2690]],
    shelves:[shelf(351,384,156,'archive'),shelf(612,378,127,'archive'),shelf(1000,382,173,'cabinet'),shelf(1215,309,157,'archive'),shelf(1720,376,155,'archive'),shelf(1930,306,151,'cabinet'),shelf(2302,374,130,'archive')],
    blocks:[block(217,326,'stapler'),block(1070,325,'usb'),block(1710,326,'stapler'),block(2405,327,'coffee')],
    pages:[row(143,431,4),row(388,347,3),row(633,343,3),row(780,414,4,48,57),row(1026,347,3),row(1239,273,3),row(1457,413,4,50,58),row(1750,339,3),row(1963,271,3),row(2084,416,4,49,55),row(2330,337,3),row(2470,432,2)],
    enemies:[foe('ghost',280),foe('typo',1102,FLOOR,80),foe('bug',1330),foe('ghost',1540),foe('bug',1895),foe('typo',2380,FLOOR,75)],traps:[trap('spill',543,57),trap('spill',1640,53)],signs:[[227,'顶砖拿订书机 · 按 X 发射'],[975,'应急灯正常 · 注意幽灵']]}),
  stage({name:'走廊冲刺',area:'消防通道及电梯',chapter:'密封清单',note:'倒计时走得更快。跟着页码连跳，电梯台可载你上升。', floor:'tile',time:88,rate:1.30,required:9,bonus:16,width:3160,end:2980,
    ground:[[0,548],[670,1105],[1238,1520],[1640,1900],[2280,2550],[2675,3160]],
    shelves:[shelf(385,382,137,'elevator'),shelf(782,382,139,'elevator'),shelf(950,307,136,'cabinet'),shelf(1340,380,122,'elevator'),shelf(1933,411,109,'elevator',24,1.6,true),shelf(2091,373,110,'mover',23,1.45),shelf(2350,383,126,'elevator'),shelf(2780,378,127,'cabinet')],
    blocks:[block(240,326,'stapler'),block(730,326,'coffee'),block(1370,326,'usb'),block(2400,326,'stapler')],
    pages:[row(143,431,4),row(412,345,3),row(523,410,4,52,58),row(800,348,3),row(978,270,2),row(1076,414,5,49,66),row(1361,345,3),row(1500,409,4,53,61),row(1740,431,3),row(1900,370,5,74,47),row(2180,346,4,48,22),row(2367,345,3),row(2520,411,5,49,52),row(2810,342,3),row(2910,432,2)],
    enemies:[foe('ghost',310),foe('bug',760),foe('typo',1005,FLOOR,62),foe('bug',1325,FLOOR,58),foe('typo',1748,FLOOR,66),foe('ghost',1845),foe('bug',2450,FLOOR,62),foe('typo',2800,FLOOR,74)], traps:[trap('spill',864,46),trap('spill',1780,46)], signs:[[190,'倒计时加速 · 听节拍'],[1740,'电梯跳台 · 两次起跳']]}),
  stage({name:'投标大厅决战',area:'开标大厅',chapter:'完整标书',note:'带齐页码能削弱废标风险兽。踩头或发射钉书针，击败三阶段后再提交。', floor:'hall',time:108,required:8,bonus:15,width:2780,end:2610,
    ground:[[0,805],[920,2780]],
    shelves:[shelf(300,382,162,'desk'),shelf(590,374,151,'hall'),shelf(1025,380,145,'cabinet'),shelf(1250,379,155,'hall'),shelf(1470,389,134,'hall'),shelf(1730,390,125,'hall'),shelf(2178,390,146,'hall')],
    blocks:[block(490,326,'stapler'),block(1140,325,'usb'),block(1585,326,'stapler')],
    pages:[row(148,432,4),row(326,347,3),row(511,434,2,43),row(617,339,3),row(776,410,5,49,63),row(1050,343,3),row(1280,345,3),row(1492,354,2),row(2400,432,3)],
    enemies:[foe('typo',675,FLOOR,67),foe('bug',1110,FLOOR,67)],traps:[],signs:[[500,'顶砖补给 · X 发射'],[1255,'页码越齐 · 废标护甲越薄']],boss:{x:2060, gate:1660, arenaEnd:2390, weakPages:15}})
];

export const palettes = [
  {sky:'#c8dfed', high:'#edf6fc', far:'#b3cedd', near:'#91adc2', floor:'#567789', top:'#f1f8fc', glow:'#4ee6f0', night:'#284c6a'},
  {sky:'#d5e5ef', high:'#f7fbfd', far:'#b9ccda', near:'#95aec1', floor:'#637c94', top:'#f4fbff', glow:'#63def5', night:'#365b76'},
  {sky:'#d2dfeb', high:'#ecf5fb', far:'#aebfd4', near:'#8fa4ba', floor:'#586b8a', top:'#e2f3ff', glow:'#77d9fc', night:'#3a4e70'},
  {sky:'#304667', high:'#667ea2', far:'#394d6d', near:'#3f5577', floor:'#3c577c', top:'#bacce6', glow:'#71efff', night:'#1d2c4c'},
  {sky:'#c6deeb', high:'#f2fbff', far:'#a9c5d7', near:'#80a8be', floor:'#4c7289', top:'#d9f2fe', glow:'#77e7f4', night:'#2d5470'},
  {sky:'#b9d5ec', high:'#effaff', far:'#9fbdd8', near:'#7e9dbf', floor:'#4c688f', top:'#e6f8ff', glow:'#76edfc', night:'#314f74'},
];

export function jamCycle(age,phase=0) {
  const slice = (age+phase)%3.15;
  return {warn:slice>=1.70 && slice<2.32, height:slice>=2.32 && slice<3.00 ? Math.sin((slice-2.32)/.68*Math.PI)*100 : 0};
}
