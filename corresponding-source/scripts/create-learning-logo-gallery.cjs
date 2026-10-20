const fs=require('node:fs'),path=require('node:path');
const root='docs/design/focusrecall-learning-50-20261016';fs.mkdirSync(root,{recursive:true});
const concepts=String.raw`const designs=[
['Pieces become one','Chunking','Separate pieces lock into one useful unit.',()=>r(18,18,23,23,6,B)+r(49,18,33,23,6,A)+r(18,49,23,33,6,A)+p('M49 49H82V82H49V70H40V59H49Z',B)],
['The gathered idea','Chunking','Three small ideas gather inside one clear boundary.',()=>r(17,17,66,66,18,A)+r(28,31,17,17,5,'var(--tile)')+r(54,31,17,17,5,'var(--tile)')+r(28,57,43,15,5,B)],
['Build the chunk','Chunking','Small blocks form a single recognisable shape.',()=>r(20,20,25,25,5,A)+r(53,20,25,25,5,B)+r(20,53,25,25,5,A)+p('M53 53H78V78H53Z',A)+s('M45 32H53M32 45V53M45 65H53',B,5)],
['A whole from parts','Chunking','Three segments share a strong circular silhouette.',()=>p('M47 16A34 34 0 0 0 16 47H47Z',A)+p('M53 16A34 34 0 0 1 84 47H53Z',B)+p('M16 54H84A34 34 0 0 1 16 54Z',A)],
['Meaningful bundle','Chunking','Three strands are held together by one amber band.',()=>s('M29 23V77M50 18V82M71 23V77',A,11)+r(18,41,64,18,8,B)],
['Organise the pieces','Chunking','Scattered inputs resolve into one ordered block.',()=>r(17,18,14,14,4,B)+r(44,20,14,14,4,B)+r(72,16,14,14,4,B)+s('M24 39L40 52M52 40V51M78 37L62 52',A,5)+r(29,57,43,27,9,A)],
['Joined understanding','Chunking','Two complementary pieces become a stable whole.',()=>p('M18 25H47V40Q59 34 60 46Q59 58 47 52V76H18Z',A)+p('M54 25H82V76H54V60Q70 60 70 46Q70 31 54 33Z',B)],
['The central chunk','Chunking','A substantial central idea replaces many loose fragments.',()=>c(50,52,22,A)+r(18,16,13,13,4,B)+r(70,18,13,13,4,B)+r(74,73,13,13,4,B)+s('M29 30L36 36M70 31L65 37M72 73L67 67',B,5)],
['Layered knowledge','Chunking','Layers of information settle into one compact form.',()=>p('M16 33L50 17L84 33L50 49Z',B)+p('M16 46L50 62L84 46V59L50 75L16 59Z',A)+p('M16 66L50 82L84 66V77L50 93L16 77Z',A)],
['Chunk in context','Chunking','One highlighted piece belongs to a larger organised whole.',()=>r(17,18,66,65,15,A)+r(28,29,18,19,4,B)+r(54,29,18,19,4,'var(--tile)')+r(28,56,18,16,4,'var(--tile)')+r(54,56,18,16,4,'var(--tile)')],
['Connect the chunks','Connections','Two substantial ideas meet through one intentional link.',()=>s('M36 50H64',B,11)+r(15,31,28,38,10,A)+r(57,31,28,38,10,A)+c(50,50,7,B)],
['A new connection','Connections','An amber bridge links two previously separate structures.',()=>p('M16 79V39L35 23L48 39V79H35V46L29 40V79Z',A)+p('M55 79V39L71 23L87 39V79H74V46L68 40V79Z',A)+s('M36 57Q50 38 66 57',B,8)],
['Link and return','Connections','A learning loop connects one idea back to another.',()=>s('M30 35Q50 14 72 35M71 65Q50 86 28 65',B,7)+r(16,36,25,28,8,A)+r(59,36,25,28,8,A)+p('M63 24L77 36H60Z',B)+p('M38 76L23 64H41Z',B)],
['Cross the gap','Connections','A broad connecting arch spans a visible gap.',()=>p('M17 78V50Q17 22 50 22Q83 22 83 50V78H68V50Q68 37 50 37Q32 37 32 50V78Z',A)+r(40,59,20,19,5,B)],
['Woven knowledge','Connections','Two distinct strands become one interwoven structure.',()=>s('M21 22L79 78',A,15)+s('M78 22L22 78',B,15)+s('M39 39L61 61',A,15)],
['Combine perspectives','Connections','Two open arcs share a central recalled idea.',()=>s('M39 22A29 29 0 0 0 39 78',A,11)+s('M61 22A29 29 0 0 1 61 78',A,11)+r(37,37,26,26,8,B)],
['Connected chapters','Connections','Two pages become more useful through a shared connection.',()=>p('M18 23L45 32V77L18 68Z',A)+p('M82 23L55 32V77L82 68Z',A)+s('M34 49Q50 38 66 49',B,7)+c(50,44,5,B)],
['Idea constellation','Connections','A small number of meaningful chunks form a connected map.',()=>s('M28 30L72 29L52 73Z',A,6)+c(28,30,13,A)+c(72,29,13,A)+c(52,73,14,B)],
['Common thread','Connections','One amber line connects several different ideas.',()=>s('M20 70Q37 20 52 50Q69 81 81 29',B,9)+r(15,61,19,19,6,A)+r(40,38,22,22,7,A)+r(70,18,20,20,6,A)],
['The connecting fold','Connections','Two planes meet around a bright central fold.',()=>p('M17 24L45 38V80L17 65Z',A)+p('M83 24L55 38V80L83 65Z',A)+p('M45 38L50 25L55 38V80L50 88L45 80Z',B)],
['Bring it back','Active recall','One amber idea is retrieved from an organised store.',()=>r(18,22,49,57,12,A)+r(29,34,13,13,4,'var(--tile)')+r(46,34,11,13,3,'var(--tile)')+s('M46 65H70Q83 65 83 49V39',B,8)+p('M72 44L83 31L94 44Z',B)],
['Reconstruct','Active recall','A missing piece returns to complete the whole.',()=>p('M19 20H49V49H79V80H19Z',A)+r(57,17,24,24,6,B)+s('M83 48V63',B,5)+p('M75 58L83 70L91 58Z',B)],
['From memory','Active recall','An idea emerges from the open centre of a memory loop.',()=>s('M72 28A32 32 0 1 0 79 63',A,11)+r(40,40,21,21,6,B)+s('M61 50H84',B,7)+p('M77 40L90 50L77 60Z',B)],
['Recall the chapter','Active recall','A return gesture rises from the centre of an open book.',()=>p('M17 42Q35 35 46 47V81Q33 69 17 75Z',A)+p('M83 42Q65 35 54 47V81Q67 69 83 75Z',A)+s('M67 31Q50 11 33 31',B,8)+p('M26 19L27 39L46 33Z',B)],
['Uncover the idea','Active recall','A lifted cover reveals the piece you can remember.',()=>r(26,34,52,48,11,A)+p('M19 22L64 13L76 31L31 41Z',B)+r(39,49,25,20,6,'var(--tile)')],
['Recall card','Active recall','A sturdy card carries a single returning gesture.',()=>r(19,19,63,64,14,A)+s('M65 54Q65 37 48 37H34',B,8)+p('M41 27L29 37L41 47Z',B)+r(35,65,27,5,2,'var(--tile)')],
['Find the missing link','Active recall','A retrieved piece closes an unfinished connection.',()=>s('M28 39Q18 23 36 18Q48 16 52 30L67 63Q75 82 57 85Q44 87 39 73',A,10)+s('M29 62L38 70M64 31L73 39',B,9)+c(74,27,10,B)],
['Recall before looking','Active recall','The remembered piece sits outside the closed source.',()=>r(22,30,46,53,10,A)+s('M32 43H55M32 54H49','var(--tile)',4)+r(59,13,23,23,7,B)+s('M76 45V61',B,5)],
['Memory in motion','Active recall','An inner chunk returns through an open outer ring.',()=>s('M71 24A33 33 0 1 0 82 59',A,10)+p('M62 16L82 24L67 39Z',A)+p('M37 37H60V61H37Z',B)+s('M60 49H83',B,7)],
['Rebuild the pattern','Active recall','One amber tile restores a familiar three-part pattern.',()=>r(18,18,27,27,6,A)+r(18,55,27,27,6,A)+r(55,55,27,27,6,A)+r(55,18,27,27,6,B)+s('M49 31H52M68 48V51',B,5)],
['Return with space','Return & spacing','Three encounters are separated by progressively larger gaps.',()=>s('M18 68H84',A,7)+r(16,36,13,23,5,A)+r(39,30,13,29,5,A)+r(72,22,13,37,5,B)+s('M19 82Q50 94 80 80',B,5)],
['Learning loop','Return & spacing','A repeated cycle surrounds a growing central chunk.',()=>s('M27 29Q50 9 75 31M76 70Q51 91 26 71',A,9)+p('M66 19L81 34H61Z',A)+p('M35 82L19 66H39Z',A)+r(35,35,30,30,10,B)],
['Revisit the page','Return & spacing','A page is revisited through one clear circular path.',()=>r(31,28,34,44,7,A)+s('M74 29A33 33 0 1 1 28 25',B,7)+p('M19 21L36 17L32 34Z',B)+s('M41 42H55M41 53H53','var(--tile)',4)],
['Three returns','Return & spacing','Three recurring arcs build around the same central idea.',()=>s('M32 37Q50 16 68 37',A,8)+s('M23 52Q50 24 77 52',A,8)+s('M16 69Q50 35 84 69',B,8)+r(41,68,18,18,5,A)],
['Spaced chapters','Return & spacing','A timeline links three separate encounters with the material.',()=>s('M19 74H83',A,6)+r(14,30,16,33,5,A)+r(39,23,18,40,5,A)+r(72,15,17,48,5,B)+c(22,74,5,B)+c(48,74,5,B)+c(80,74,5,B)],
['Keep coming back','Return & spacing','Two returning paths revisit a single stable chunk.',()=>r(35,35,30,30,10,A)+s('M18 47Q18 16 49 16H66M82 53Q82 84 51 84H34',B,7)+p('M59 7L74 16L59 25Z',B)+p('M41 75L26 84L41 93Z',B)],
['The returning bookmark','Return & spacing','A bookmark is enclosed by an incomplete revisit loop.',()=>p('M36 24H64V77L50 65L36 77Z',A)+s('M75 27A35 35 0 1 1 23 24',B,7)+p('M16 20L33 18L28 35Z',B)],
['Intervals','Return & spacing','One steady baseline holds deliberately separated study moments.',()=>r(15,30,12,41,6,A)+r(36,30,12,41,6,A)+r(72,30,12,41,6,B)+s('M22 83H78',A,5)+c(22,18,4,A)+c(42,18,4,A)+c(78,18,4,B)],
['Recall spiral','Return & spacing','A broad spiral returns inward toward the useful idea.',()=>s('M80 45Q79 17 50 17Q17 17 17 50Q17 83 50 83Q77 83 77 57Q77 34 55 34Q36 34 36 52Q36 66 52 66',A,8)+c(52,53,8,B)],
['A stronger thread','Return & spacing','Repeated encounters reconnect to the same central understanding.',()=>s('M24 25L50 51L78 24M50 51L25 80M50 51L79 79',A,6)+c(24,25,8,A)+c(78,24,10,A)+c(25,80,10,A)+c(79,79,12,B)+c(50,51,12,B)],
['Focus then connect','Focus & rest','A focused point opens into a wider field of connections.',()=>s('M30 23H18V77H30',A,8)+r(27,39,22,22,7,A)+s('M50 50L76 27M50 50H82M50 50L76 73',B,6)+c(77,25,7,B)+c(84,50,7,B)+c(77,75,7,B)],
['Narrow / broad','Focus & rest','A concentrated left side unfolds into a wider perspective.',()=>p('M17 39H39V61H17Z',A)+p('M47 37L83 18V82L47 63Z',B)+s('M38 50H54',A,8)],
['Pause and return','Focus & rest','A pause is part of the returning study cycle.',()=>s('M75 30A32 32 0 1 0 79 65',A,9)+p('M64 17L83 32H61Z',A)+r(37,37,9,29,4,B)+r(54,37,9,29,4,B)],
['Room for a connection','Focus & rest','An open centre lets two separate ideas meet.',()=>s('M33 22H20V78H33M67 22H80V78H67',A,8)+s('M37 61L63 39',B,7)+c(34,64,9,A)+c(66,36,9,B)],
['Converge / unfold','Focus & rest','Two contrasting gestures represent concentrating and opening out.',()=>s('M18 25L43 50L18 75',A,11)+s('M82 25L57 50L82 75',B,11)+c(50,50,7,A)],
['Quiet interval','Focus & rest','An amber break separates two substantial study periods.',()=>r(16,26,25,48,9,A)+r(59,26,25,48,9,A)+c(50,50,6,B)+s('M47 24H53M47 76H53',B,4)],
['One idea, wider view','Focus & rest','A focused chunk sits inside a wider, open perspective.',()=>s('M25 30A34 34 0 0 1 81 36M75 70A34 34 0 0 1 19 64',A,8)+r(37,37,26,26,9,B)+c(20,51,4,B)+c(80,51,4,B)],
['Shift perspective','Focus & rest','Two rotated frames keep the same central idea in view.',()=>r(22,22,55,55,11,A)+g(r(31,31,38,38,8,B),'rotate(45 50 50)')+c(50,50,9,'var(--tile)')],
['The useful pause','Focus & rest','A clear pause makes space for a new connection.',()=>r(20,24,12,52,5,A)+r(39,24,12,52,5,A)+s('M57 50H81',B,6)+c(80,29,8,B)+c(80,71,8,B)+s('M65 50L76 35M65 50L76 65',B,5)],
['Focus · connect · recall','Focus & rest','A focal chunk, a connection and a return form one cycle.',()=>r(19,35,24,29,8,A)+s('M43 50H73',B,8)+c(75,50,12,B)+s('M75 27Q50 10 25 26M25 76Q50 91 75 75',A,7)+p('M30 16L17 28H36Z',A)+p('M69 85L82 73H63Z',A)]
].map(([name,group,description,draw],i)=>({id:i+1,name,group,description,draw}));`;
let html=fs.readFileSync('docs/design/focusrecall-vector-50-20261016/index.html','utf8');const start=html.indexOf('const designs=['),end=html.indexOf('const palettes=',start);html=html.slice(0,start)+concepts+'\n'+html.slice(end);
html=html.replace(/const palettes=\[[^\n]+;/,"const palettes=[['Ink / amber','#183d56','#cc8c30','#cc8c30']];");
html=html.replaceAll('--a:#643456;--b:#7a896c;--c:#c39749','--a:#183d56;--b:#cc8c30;--c:#cc8c30').replaceAll('value="#643456"','value="#183d56"').replaceAll('value="#7a896c"','value="#cc8c30"');
html=html.replace('50 marks. Different directions.','Learn. Connect. Recall.').replace('Original SVG concepts for the same app. Judge the shape first, then try another colour. Open any card for a closer look or compare up to four.','50 vector marks built around chunking, connecting ideas, recalling from memory, and returning after a pause. One fixed Ink / Amber palette. Open a design to inspect it at actual icon sizes.').replace('all previews share the same colours','Ink / Amber throughout').replace('FocusRecall · 50 vector logo directions','FocusRecall · 50 learning-inspired vector marks').replaceAll('focusrecall-vector-favourites','focusrecall-learning-favourites');
html=html.replace('</style>','.custom,.palette{display:none!important}.fixed-palette{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;white-space:nowrap}.fixed-palette i{width:14px;height:14px;border-radius:50%;display:inline-block;background:#183d56}.fixed-palette i+i{background:#cc8c30}</style>');
html=html.replace('<button class="tool" id="savedOnly"','<span class="fixed-palette"><i></i><i></i> Ink / Amber</span><button class="tool" id="savedOnly"');
fs.writeFileSync(path.join(root,'index.html'),html);console.log('Created 50 learning-inspired SVG concepts in fixed Ink / Amber.');
