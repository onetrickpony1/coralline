import pickle,collections,csv,re,os
kinds,sc,fc,un,funa,m,fm=pickle.load(open('state.pkl','rb'))
FAM={'1':'single-panel continuous','2':'categorical x with error bars','3':'Bayesian','4':'matrix / multi-panel','5':'networks / path diagrams / trees','6':'quality control charts','7':'meta-analysis','8':'polar / circular','9':'time series','10':'Plot Builder','11':'learning / distribution demos','12':'MCMC diagnostics','13':'machine learning performance','14':'power and design curves'}
trees={}
def tree(mod):
    if mod not in trees:
        p=f'inv/trees/{mod}.txt'; trees[mod]=set(open(p).read().split('\n')) if os.path.exists(p) else set()
    return trees[mod]
rows=[]
for k in kinds:
    s=sc.get(k['id'],[]); f=fc.get(k['id'],[])
    t=k['traits']
    geoms=set(); colfill=False
    for x in f:
        geoms|=set(x[6].split(','))
    leg='L' in t; txt='T' in t or bool(geoms&{'GeomText','GeomLabel'}) ; err='E' in t or 'GeomErrorbar' in geoms
    band='B' in t or 'GeomRibbon' in geoms
    pan=k['panels']; pan={'single/multi':'multi'}.get(pan,pan)
    ex=''
    if s:
        c=collections.Counter((mm,d) for mm,d,n in s); (mm,d),_=c.most_common(1)[0]
        cand=f'tests/testthat/test-{d}.R'
        ex=f'{mm}/{cand}' if cand in tree(mm) else f'{mm}/tests/testthat/_snaps/{d}/'
    tr=sum(1 for x in f if x[4]=='True')
    ev=[]
    if s: ev.append('snapshots')
    if 'not in the deparsed dump' not in k['note']: ev.append('dump code')
    if f: ev.append('Coralline examples')
    note=k['note'].replace('not in the deparsed dump (newer code)','plot code not in the 0.99 dump; snapshot only, may be newer than 0.99')
    rows.append({'module':k['module'],'analysis':k['analysis'],'plot_kind':k['id'],'family':f"{k['family']} {FAM[k['family']]}",
      'panels':pan,'has_legend':'yes' if leg else 'no','has_text_annotations':'yes' if txt else 'no','error_bars':'yes' if err else 'no',
      'bands':'yes' if band else 'no','categorical_x':'yes' if 'C' in t else 'no','coded_levels_possible':'yes' if 'K' in t else 'no',
      'plotmath_titles':'yes' if 'P' in t else 'no','non_ggplot':k['nonggplot'] or 'no',
      'upstream_snapshots':len(s),'example_test_file':ex,'in_coralline_examples':len(f),'coralline_trusted':tr,
      'evidence':'; '.join(ev),'notes':note})
cols=list(rows[0].keys())
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','plot-inventory.csv'),'w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=cols); w.writeheader(); w.writerows(rows)
# stats
fam=collections.Counter(r['family'] for r in rows)
for kf,v in sorted(fam.items(),key=lambda x:int(x[0].split()[0])):
    cov=sum(1 for r in rows if r['family']==kf and r['in_coralline_examples']>0)
    trs=sum(1 for r in rows if r['family']==kf and r['coralline_trusted']>0)
    sn=sum(1 for r in rows if r['family']==kf and r['upstream_snapshots']>0)
    print(f"{kf}|{v}|{sn}|{cov}|{trs}")
print('total',len(rows),'snap',sum(1 for r in rows if r['upstream_snapshots']), 'cov',sum(1 for r in rows if r['in_coralline_examples']),'trusted',sum(1 for r in rows if r['coralline_trusted']),'fully trusted',sum(1 for r in rows if r['in_coralline_examples'] and r['coralline_trusted']==r['in_coralline_examples']))
print('neither',sum(1 for r in rows if not r['upstream_snapshots'] and not r['in_coralline_examples']))
print('figs',sum(r['in_coralline_examples'] for r in rows),'trusted figs',sum(r['coralline_trusted'] for r in rows))
mods=collections.Counter(r['module'].split()[0] for r in rows); print(len(mods), sorted(mods.items()))
print('nonggplot',collections.Counter(r['non_ggplot'] for r in rows))
for r in rows:
    if r['in_coralline_examples'] and r['coralline_trusted']==0: print('UNTRUSTED',r['plot_kind'],r['in_coralline_examples'])
pickle.dump(rows,open('rows.pkl','wb'))
