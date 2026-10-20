const fs=require('node:fs');
const rows={
 '{context}: {option} goes with {direction} reported {outcome}.':[
 '{context}: {option} se asocia con un nivel declarado de {outcome} {direction}.',
 '{context}: {option} está associado a um nível informado de {outcome} {direction}.',
 '{context}: {option}. Der angegebene Wert für {outcome} ist {direction}.'],
 '{context}: {option} is associated with {minutes} minutes {direction} focused sessions.':[
 '{context}: {option} se asocia con sesiones cuya duración de concentración es {minutes} minutos {direction}.',
 '{context}: {option} está associado a sessões cuja duração do foco é {minutes} minutos {direction}.',
 '{context}: {option}. Die erfasste Fokusdauer ist um {minutes} Minuten {direction}.'],
 '{option} starts are associated with {direction} reported {outcome}.':[
 'Empezar a las {option} se asocia con un nivel declarado de {outcome} {direction}.',
 'Começar às {option} está associado a um nível informado de {outcome} {direction}.',
 'Bei Starts um {option} ist der angegebene Wert für {outcome} {direction}.'],
 'Days with {option} of sleep show {direction} reported {outcome}.':[
 'Los días con {option} de sueño muestran un nivel declarado de {outcome} {direction}.',
 'Dias com {option} de sono mostram um nível informado de {outcome} {direction}.',
 'An Tagen mit {option} Schlaf ist der angegebene Wert für {outcome} {direction}.'],
 'After {option} of recorded rest, reported {outcome} is {direction}.':[
 'Tras {option} de descanso registrado, el nivel declarado de {outcome} es {direction}.',
 'Após {option} de descanso registrado, o nível informado de {outcome} é {direction}.',
 'Nach {option} erfasster Pause ist der angegebene Wert für {outcome} {direction}.'],
 'For {context}, {option} focused sessions show {direction} reported {outcome}.':[
 'En {context}, las sesiones de concentración de {option} muestran un nivel declarado de {outcome} {direction}.',
 'Em {context}, sessões de foco de {option} mostram um nível informado de {outcome} {direction}.',
 'Bei {context} ist in Fokussitzungen von {option} der angegebene Wert für {outcome} {direction}.'],
 'Your reported {outcome} was {direction} in the latest four weeks.':[
 'Tu nivel declarado de {outcome} fue {direction} en las últimas cuatro semanas.',
 'Seu nível informado de {outcome} foi {direction} nas últimas quatro semanas.',
 'Dein angegebener Wert für {outcome} war in den letzten vier Wochen {direction}.'],
 'Reported {outcome} is {direction} in comparable sessions this week.':[
 'El nivel declarado de {outcome} es {direction} en las sesiones comparables de esta semana.',
 'O nível informado de {outcome} é {direction} nas sessões comparáveis desta semana.',
 'Der angegebene Wert für {outcome} ist in vergleichbaren Sitzungen dieser Woche {direction}.']
};
for(const [i,lang] of ['es','pt-BR','de'].entries()){const file='src/core/locales/'+lang+'.json',catalog=JSON.parse(fs.readFileSync(file,'utf8'));for(const [key,values] of Object.entries(rows))catalog[key]=values[i];fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n')}
