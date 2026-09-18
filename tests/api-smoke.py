"""Local-only integration checks. Restores the pre-test wardrobe afterwards."""
import urllib.request, urllib.error, json, uuid
BASE='http://localhost:5173'
def req(path,method='GET',data=None,ctype='application/json',auth=True):
 headers={'Content-Type':ctype,'Origin':BASE}
 if auth: headers['Cookie']='__sites_local_auth=1'
 body=json.dumps(data).encode() if isinstance(data,dict) else data
 try:
  with urllib.request.urlopen(urllib.request.Request(BASE+path,data=body,headers=headers,method=method),timeout=20) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
assert req('/api/state',auth=False)[0]==401
code,raw=req('/api/state');assert code==200;original=json.loads(raw);state=json.loads(raw)
assert len(state['items'])==39
boundary='hyope-test-boundary';image=open('public/wardrobe/602-75.png','rb').read()
body=('--'+boundary+'\r\nContent-Disposition: form-data; name="photo"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n').encode()+image+('\r\n--'+boundary+'--\r\n').encode()
code,raw=req('/api/upload','POST',body,'multipart/form-data; boundary='+boundary);assert code==200,raw
photo=json.loads(raw)['image'];assert req(photo)[1]==image;assert req(photo,auth=False)[0]==401
item={**state['items'][0],'id':str(uuid.uuid4()),'name':'Temporary integration-test garment','image':photo,'sourceNode':'','sourceSection':'','sourceHash':''}
try:
 state['items'].append(item)
 code,raw=req('/api/state','PUT',state);assert code==200,raw
 state['revision']=json.loads(raw)['revision']
 loaded=json.loads(req('/api/state')[1]);assert any(i['id']==item['id'] for i in loaded['items'])
 stale={**state,'revision':state['revision']-1};assert req('/api/state','PUT',stale)[0]==409
 invalid={**state,'weather':{**state['weather'],'humidity':101}};assert req('/api/state','PUT',invalid)[0]==400
 state['items'][-1]['name']='Edited temporary garment'
 code,raw=req('/api/state','PUT',state);assert code==200;state['revision']=json.loads(raw)['revision']
 assert json.loads(req('/api/state')[1])['items'][-1]['name']=='Edited temporary garment'
finally:
 original['revision']=json.loads(req('/api/state')[1])['revision']
 assert req('/api/state','PUT',original)[0]==200
assert len(json.loads(req('/api/state')[1])['items'])==39
code,raw=req('/api/weather?city=Toronto');print('City search:',code,json.loads(raw).get('locations',[{}])[0].get('name',json.loads(raw).get('error')))
code,raw=req('/api/weather?lat=43.65&lon=-79.38');data=json.loads(raw)
assert code in [200,503]
if code==200:assert data['source']=='live' and isinstance(data['feels'],(float,int))
else:assert 'manually' in data['error']
assert req('/api/weather?lat=999&lon=0')[0]==400
print('PASS: auth, image upload/read, add, edit, reload, delete/restore, revision conflict, validation, weather/fallback')
