import {it,expect} from 'vitest'
import {schemaTokens} from '../main/db/schemaTokens'
it('ignores formatting around punctuation and SQL comments without merging tokens',()=>{
 expect(schemaTokens('CREATE TABLE t ( id INTEGER PRIMARY KEY, v TEXT NOT NULL )')).toBe(schemaTokens('CREATE TABLE t(id INTEGER PRIMARY KEY,v TEXT NOT NULL)'))
 expect(schemaTokens('CREATE TABLE t(/*comment*/id INTEGER -- note\n PRIMARY KEY)')).toBe(schemaTokens('CREATE TABLE t(id INTEGER PRIMARY KEY)'))
 expect(schemaTokens('NOT NULL')).not.toBe(schemaTokens('NOTNULL'))
})
it('retains every constraint, operator, literal and identifier token',()=>{
 const sql="CREATE TABLE t(id INTEGER PRIMARY KEY,v TEXT NOT NULL DEFAULT 'two  spaces' CHECK(v != 'x'))"
 for(const changed of [sql.replace('PRIMARY KEY',''),sql.replace('NOT NULL',''),sql.replace('!=','='),sql.replace('two  spaces','two spaces'),sql.replace('CHECK(v', 'CHECK(id')])expect(schemaTokens(sql)).not.toBe(schemaTokens(changed))
 expect(schemaTokens('SELECT "two  spaces"')).not.toBe(schemaTokens('SELECT "two spaces"'))
 expect(schemaTokens("SELECT 'it''s  quoted'")).not.toBe(schemaTokens("SELECT 'it''s quoted'"))
 expect(schemaTokens('SELECT a || b')).not.toBe(schemaTokens('SELECT a | | b'))
 expect(()=>schemaTokens("SELECT 'unterminated")).toThrow();expect(()=>schemaTokens('/*unfinished')).toThrow()
})
