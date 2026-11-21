import re,collections,csv,sys
sys.path.insert(0,'.')
from catalogue import CAT
inv='inv/'
kinds=[]
for line in CAT.strip().split('\n'):
    f=[x.strip() for x in re.split(r' \|(?= |$)',line)]
    f+=['']*(10-len(f))
    kinds.append(dict(zip(['id','module','analysis','family','panels','traits','nonggplot','snap','fig','note'],f[:10])))
ids=[k['id'] for k in kinds]; assert len(ids)==len(set(ids)),[i for i in ids if ids.count(i)>1]
snaps=[l.rstrip('\n').split('\t') for l in open(inv+'snaps.tsv')]
sc=collections.defaultdict(list); unassigned=[]; multi=[]
for m,d,n in snaps:
    nn=re.sub(r'^analysis-\d+[-_]figure-\d+[-_]?','',n); nn=re.sub(r'-subplot-\d+(?=\.svg$)','',nn)
    key=f"{m.replace('jasp','',1)}/{d}/{nn}"
    if m in ('jaspGraphs','jaspIrt','jaspLearnN1'): sc['_excluded_'+m].append((m,d,n)); continue
    hits=[k['id'] for k in kinds if k['snap'] and re.search(k['snap'],key)]
    if not hits: unassigned.append(key)
    else:
        if len(hits)>1: multi.append((key,hits))
        sc[hits[0]].append((m,d,n))
figs=[l.rstrip('\n').split('\t') for l in open(inv+'figs.tsv')]
fc=collections.defaultdict(list); funa=[]; fmulti=[]
for f in figs:
    parts=f[2].split('_'); keys=[f"{f[1]}|{'_'.join(parts[i:])}|{f[3]}" for i in range(len(parts))]
    hits=[k['id'] for k in kinds if k['fig'] and any(re.search(k['fig'],key) for key in keys)]
    key=keys[0]
    if not hits: funa.append(key)
    else:
        if len(hits)>1: fmulti.append((key,hits))
        fc[hits[0]].append(f)
import pickle; pickle.dump((kinds,sc,fc,unassigned,funa,multi,fmulti),open('state.pkl','wb'))
print('kinds',len(kinds),'snaps assigned',sum(map(len,sc.values())),'unassigned',len(unassigned),'multi',len(multi))
print('figs assigned',sum(map(len,fc.values())),'unassigned',len(funa),'multi',len(fmulti))
if '-v' in sys.argv:
    for u in sorted(set(re.sub(r'-\d+\.svg$','',x) for x in unassigned)): print('U',u)
    for k,h in multi[:400]: print('M',k,h)
    for u in sorted(set(funa)): print('FU',u)
    for k,h in fmulti: print('FM',k,h)
