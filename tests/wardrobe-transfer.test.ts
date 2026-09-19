import test from 'node:test';
import assert from 'node:assert/strict';
import { readWardrobeBackup,sameWardrobe } from '../lib/wardrobe-transfer';
import {initialItems,defaultPreferences,defaultWeather} from '../lib/wardrobe';
const state={items:initialItems,fits:[],preferences:defaultPreferences,weather:defaultWeather,revision:3};
test('transfers preserve all validated data independently of each site revision',()=>{
 const backup=readWardrobeBackup(JSON.stringify(state));
 assert.deepEqual(backup,state);
 assert(sameWardrobe(backup,{...backup,revision:100}));
 assert(!sameWardrobe(backup,{...backup,items:backup.items.slice(1)}));
});
test('invalid, conflicting and nonportable backups fail before writing',()=>{
 assert.throws(()=>readWardrobeBackup('{bad'));
 assert.throws(()=>readWardrobeBackup(JSON.stringify({...state,items:[state.items[0],state.items[0]]})));
 assert.throws(()=>readWardrobeBackup(JSON.stringify({...state,items:[{...state.items[0],image:'/api/image/upload-id'}]})),/uploaded photos/);
 assert.throws(()=>readWardrobeBackup(' '.repeat(2000001)),/2 MB/);
});
