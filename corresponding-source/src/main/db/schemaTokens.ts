/** Compare the shipped SQL token stream, not sqlite_master's formatting.
 * Whitespace/comments between tokens have no SQL meaning. Quoted tokens remain
 * byte-exact: never collapse spaces inside CHECK/default literals or identifiers.
 * This is lexical comparison, not a permissive SQL-equivalence rewrite.
 */
export function schemaTokens(sql:string):string {
 const tokens:string[]=[]
 for(let i=0;i<sql.length;){
  const c=sql[i],next=sql[i+1]
  if(/\s/.test(c)){i++;continue}
  if(c==='-'&&next==='-'){const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end+1;continue}
  if(c==='/'&&next==='*'){const end=sql.indexOf('*/',i+2);if(end<0)throw Error('The backup schema is incomplete or incompatible.');i=end+2;continue}
  if(c==="'"||c==='"'||c==='`'||c==='['){
   const start=i,close=c==='['?']':c;i++;let closed=false
   while(i<sql.length){if(sql[i]===close){i++;if(c!=='['&&sql[i]===close){i++;continue}closed=true;break}i++}
   if(!closed)throw Error('The backup schema is incomplete or incompatible.');tokens.push(sql.slice(start,i));continue
  }
  const word=/^[A-Za-z_\u0080-\uFFFF][A-Za-z_0-9$\u0080-\uFFFF]*/.exec(sql.slice(i))
  if(word){tokens.push(word[0]);i+=word[0].length;continue}
  const number=/^(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)/.exec(sql.slice(i))
  if(number){tokens.push(number[0]);i+=number[0].length;continue}
  const operator=/^(?:->>|->|==|!=|<>|<=|>=|<<|>>|\|\|)/.exec(sql.slice(i))
  if(operator){tokens.push(operator[0]);i+=operator[0].length;continue}
  tokens.push(c);i++
 }
 return JSON.stringify(tokens)
}
