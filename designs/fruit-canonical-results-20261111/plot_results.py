"""Scientific figures from the canonical experiment's frozen images and recorded predictions."""
from pathlib import Path
from collections import defaultdict
import os,json,hashlib
os.environ.setdefault('MPLCONFIGDIR','/tmp/fruit-canonical-mpl')
import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle,FancyBboxPatch,FancyArrowPatch
from PIL import Image
ROOT=Path(__file__).resolve().parent
EXP=Path('/Users/cqc/fruit_train/output/canonical_rebuild_20261111')
OUT=ROOT/'exports';OUT.mkdir(parents=True,exist_ok=True)
S=json.loads((EXP/'evaluation/summary.json').read_text())
D=json.loads((EXP/'evaluation/predictions.json').read_text())
P=json.loads((EXP/'evaluation/paired-image-outcomes.json').read_text())
CROPS=['apple','pear','onion','pepper','pumpkin','tomato']
COLORS=['#BA5730','#237A97'];KEYS=['composite','two_stage'];NAMES=['A: composite labels','B: type + ripeness']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':12,'axes.labelsize':10,'axes.spines.top':False,'axes.spines.right':False,'axes.grid':False,'grid.color':'#d9dee3','grid.linestyle':':','axes.axisbelow':True,'figure.facecolor':'white','savefig.facecolor':'white','svg.fonttype':'none'})
receipts=[]
def save(fig,name):
 fig.savefig(OUT/f'{name}.png',dpi=300,bbox_inches='tight',pad_inches=.17)
 fig.savefig(OUT/f'{name}.svg',bbox_inches='tight',pad_inches=.17)
 svg=OUT/f'{name}.svg';svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
 plt.close(fig)
 path=OUT/f'{name}.png';receipts.append({'id':name,'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
 print('[plot]',name,flush=True)

def crop_rows():
 result=[]
 for r in D:
  im=cv2.imread(str(EXP/r['image']));h,w=im.shape[:2]
  for i,g in enumerate(r['ground_truth']):
   x1,y1,x2,y2=g['box'];patch=im[max(0,int(y1)):min(h,int(y2)),max(0,int(x1)):min(w,int(x2))]
   if not patch.size:raise ValueError('Empty target patch')
   result.append({'type':g['type'],'state':g['state'],'image':r['image'],'index':i,'patch':patch})
 return result

C=crop_rows()
def samples():
 fig,axes=plt.subplots(2,6,figsize=(13,5),layout='constrained');chosen=[]
 for j,crop in enumerate(CROPS):
  for i,state in enumerate(['ripe','unripe']):
   rows=sorted([r for r in C if r['type']==crop and r['state']==state],key=lambda r:(r['image'],r['index']))
   selected=rows[len(rows)//2];ax=axes[i,j];ax.imshow(selected['patch'][:,:,::-1]);ax.set_axis_off();ax.set_title(f'{crop.title()} / {state}\n(n = {len(rows)})',fontsize=10)
   chosen.append({k:v for k,v in selected.items() if k!='patch'})
 fig.suptitle('Actual targets from the 60-image external cohort',fontsize=14)
 (ROOT/'sample-provenance.json').write_text(json.dumps({'selection':'Lexical median target per type/state; independent of model outcome','targets':chosen},indent=2)+'\n')
 save(fig,'canonical-samples')

def color():
 fig,axs=plt.subplots(2,3,figsize=(12,6),layout='constrained');histograms=[]
 for ax,crop in zip(axs.flat,CROPS):
  for state,col,style in [('ripe','#B84A47','-'),('unripe','#42866C','--')]:
   hs=[]
   for r in C:
    if r['type']!=crop or r['state']!=state:continue
    hsv=cv2.cvtColor(r['patch'],cv2.COLOR_BGR2HSV);mask=(hsv[:,:,1]>=40)&(hsv[:,:,2]>=40)
    h,_=np.histogram(hsv[:,:,0][mask]*2.,bins=np.arange(0,361,20));h=h/h.sum() if h.sum() else h
    hs.append(h);histograms.append({'type':crop,'state':state,'image':r['image'],'index':r['index'],'histogram':h.tolist()})
   ax.plot(np.arange(10,360,20),np.mean(hs,axis=0)*100,style,color=col,lw=1.7,label=f'{state} (n={len(hs)})')
  ax.set_title(crop.title());ax.set_xlim(0,360);ax.set_ylim(0,100);ax.set_xticks([0,90,180,270,360]);ax.grid(True,alpha=.6);ax.legend(fontsize=8,loc='upper right')
 for ax in axs[1]:ax.set_xlabel('Hue (degrees)')
 for ax in axs[:,0]:ax.set_ylabel('Mean pixel share (%)')
 fig.suptitle('Observed input colour distributions — no foreground segmentation',fontsize=13)
 (ROOT/'target-hue-histograms.json').write_text(json.dumps(histograms,indent=2)+'\n');save(fig,'canonical-color')

def architecture():
 fig,ax=plt.subplots(figsize=(12.2,5.3));ax.set_xlim(0,12.2);ax.set_ylim(0,5.3);ax.axis('off')
 def node(x,y,w,h,text,color='#eef2f4',edge='#69747c'):
  ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.04,rounding_size=.08',facecolor=color,edgecolor=edge,lw=1.1));ax.text(x+w/2,y+h/2,text,ha='center',va='center',fontsize=11,linespacing=1.7)
 def arrow(a,b):ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=14,color='#647079',lw=1.3))
 ax.text(.1,5.03,'Same source images and boxes; different supervision',fontsize=16,weight='bold')
 ax.text(.1,4.57,'Zone routing, initialization, validation and detector training settings are shared.',fontsize=10,color='#58636b')
 node(.15,1.75,2.2,1.65,'Same full image\nKnown zone\nFruit / vegetable')
 node(3.15,3.05,3.4,1.0,'A  ·  YOLO26s\n4 fruit / 8 vegetable classes',color='#fbede7',edge=COLORS[0])
 node(8.15,3.05,3.6,1.0,'Type + state in one label\nExample: pepper_ripe',color='#fbede7',edge=COLORS[0])
 node(3.15,1.0,3.4,1.0,'B  ·  YOLO26s\n2 fruit / 4 vegetable classes',color='#e9f4f7',edge=COLORS[1])
 node(7.1,1.0,2.25,1.0,'Predicted box crop\nRoute by type',color='#e9f4f7',edge=COLORS[1])
 node(9.85,1.0,2.15,1.0,'MobileNetV3\nripe / unripe',color='#e9f4f7',edge=COLORS[1])
 arrow((2.4,2.9),(3.1,3.55));arrow((2.4,2.25),(3.1,1.5));arrow((6.6,3.55),(8.1,3.55));arrow((6.6,1.5),(7.05,1.5));arrow((9.4,1.5),(9.8,1.5))
 ax.text(3.2,.53,'Red and green peppers share one type label; each fruit type has its own maturity rule.',fontsize=10,color='#58636b')
 ax.text(.15,.05,'2,460 train images + 250 validation images   |   no bad class or third stage   |   six separate maturity classifiers in B',fontsize=9,color='#58636b')
 save(fig,'canonical-architecture')

def cases():
 # Balance examples with improvement, regression, success and failure. Within each stratum choose lexical first.
 predicates=[lambda r:r['only_two_stage']>r['only_composite'],lambda r:r['only_composite']>r['only_two_stage'],lambda r:r['both_correct']==r['objects'],lambda r:r['neither_correct']==r['objects']]
 chosen=[]
 for pred in predicates:
  candidate=sorted([p for p in P if pred(p) and p['group'] not in [q['group'] for q in chosen]],key=lambda p:p['group'])
  if not candidate:raise ValueError('No case for selected outcome stratum')
  chosen.append(candidate[0])
 fig,axes=plt.subplots(4,2,figsize=(10.5,12.8),layout='constrained');provenance=[]
 for i,case in enumerate(chosen):
  row=next(r for r in D if r['group']==case['group']);im=Image.open(EXP/row['image']).convert('RGB')
  for j,key in enumerate(KEYS):
   ax=axes[i,j];ax.imshow(im);ax.set_axis_off();ax.set_title(f'{i+1} · {NAMES[j]}',fontsize=12)
   preds=row['predictions'][key]['items']
   for p in preds:
    x1,y1,x2,y2=p['box'];ax.add_patch(Rectangle((x1,y1),x2-x1,y2-y1,fill=False,edgecolor=COLORS[j],linewidth=1.8))
    ax.text(max(0,x1),max(2,y1-4),f"{p['type']}_{p['state']} {p['confidence']:.2f}",color='white',fontsize=8.5,ha='left',va='bottom',bbox={'facecolor':COLORS[j],'edgecolor':'none','pad':2})
   if not preds:ax.text(.03,.95,'No detections above 0.25',transform=ax.transAxes,color='white',va='top',fontsize=10,bbox={'facecolor':'#36434b','edgecolor':'none','pad':4})
  provenance.append({'image':row['image'],'group':row['group'],'paired_counts':case,'predictions':row['predictions']})
 (ROOT/'case-provenance.json').write_text(json.dumps({'selection':'One lexical-first example per stratum: B better, A better, both fully correct, both no correct target. Selected only for illustration; full cohort metrics unchanged.','display':'Predictions only. No GT label or GT box. Scores are detection confidence.','examples':provenance},indent=2)+'\n')
 save(fig,'canonical-cases')

def confusion():
 fig,axs=plt.subplots(1,2,figsize=(12.5,5.6),layout='constrained');labels=[x.title() for x in CROPS]
 for ax,key,name in zip(axs,KEYS,NAMES):
  mat=np.asarray(S['schemes'][key]['type_confusion_matrix']);im=ax.imshow(mat,cmap='Blues',vmin=0,vmax=20)
  ax.set_xticks(range(7),labels+['Missed'],rotation=40,ha='right');ax.set_yticks(range(7),labels+['Extra prediction']);ax.set_title(name);ax.set_xlabel('Predicted type');ax.set_ylabel('Annotated type')
  for (i,j),v in np.ndenumerate(mat):ax.text(j,i,'—' if i==6 and j==6 else str(v),ha='center',va='center',color='white' if v>11 else '#25343c',fontsize=10)
  ax.axvline(5.5,c='#51616b',lw=1);ax.axhline(5.5,c='#51616b',lw=1)
 fig.colorbar(im,ax=axs,shrink=.7,label='Target count');fig.suptitle('60 held-out images / 91 targets — misses and extra predictions retained',fontsize=13)
 save(fig,'canonical-confusion')

def performance():
 fig,axs=plt.subplots(1,2,figsize=(12.4,4.8),layout='constrained');x=np.arange(3);w=.35
 for i,(key,name,col) in enumerate(zip(KEYS,NAMES,COLORS)):
  s=S['schemes'][key];vals=[s['type_precision']*100,s['type_recall']*100,s['joint_recall']*100]
  bars=axs[0].bar(x+(i-.5)*w,vals,w,label=name,color=col);axs[0].bar_label(bars,fmt='%.1f%%',padding=4,fontsize=9)
  vals=[s['missed'],s['cross_type_errors'],s['unmatched_predictions']];bars=axs[1].bar(x+(i-.5)*w,vals,w,label=name,color=col);axs[1].bar_label(bars,padding=4,fontsize=10)
 axs[0].set_xticks(x,['Type\nprecision','Type\nrecall','Type + state\nrecall']);axs[0].set_ylim(0,100);axs[0].set_ylabel('Percent');axs[0].set_title('Detection and complete recognition')
 axs[1].set_xticks(x,['Missed\ntargets','Wrong\ntype','Extra\npredictions']);axs[1].set_ylim(0,55);axs[1].set_ylabel('Count');axs[1].set_title('Where the pipeline fails')
 for ax in axs:ax.grid(axis='y',alpha=.6)
 fig.legend(*axs[0].get_legend_handles_labels(),loc='outside lower center',ncol=2,frameon=False)
 save(fig,'canonical-performance')

def batches():
 names={'capture_20260819':'08-19 · vegetables','capture_20260823':'08-23 · fruit','capture_20260916':'09-16 · vegetables','capture_20261010':'10-10 · vegetables','capture_20261015':'10-15 · vegetables'}
 ordered=sorted(S['by_capture_batch']);fig,ax=plt.subplots(figsize=(10.4,4.8),layout='constrained');y=np.arange(len(ordered));h=.34
 for i,(key,col,name) in enumerate(zip(KEYS,COLORS,NAMES)):
  vals=[S['by_capture_batch'][b][key]['joint_recall']*100 for b in ordered]
  bars=ax.barh(y+(i-.5)*h,vals,h,color=col,label=name)
  for b,bar in zip(ordered,bars):
   s=S['by_capture_batch'][b][key];ax.text(bar.get_width()+1,bar.get_y()+bar.get_height()/2,f"{s['joint_correct']}/{s['ground_truth']}",va='center',fontsize=10)
 ax.set_yticks(y,[names[b] for b in ordered]);ax.invert_yaxis();ax.set_xlim(0,110);ax.set_xticks([0,20,40,60,80,100]);ax.set_xlabel('Type + state recall (%)');ax.grid(axis='x');ax.legend(loc='lower right',frameon=False);ax.set_title('Results vary by capture batch; labels show correct / all targets')
 save(fig,'canonical-batches')

def confidence():
 values=[[p['confidence'] for r in D for p in r['predictions'][key]['items']] for key in KEYS]
 fig,ax=plt.subplots(figsize=(7.8,4.6),layout='constrained');bp=ax.boxplot(values,patch_artist=True,tick_labels=[f'{name}\n(n={len(v)})' for name,v in zip(NAMES,values)],medianprops={'color':'#26353d','linewidth':1.5},flierprops={'marker':'.','markersize':5})
 for box,col in zip(bp['boxes'],COLORS):box.set_facecolor(col);box.set_alpha(.55)
 ax.set_ylim(.2,1.02);ax.set_ylabel('Detection confidence');ax.axhline(.25,color='#717c84',ls='--',lw=1);ax.text(1.05,.265,'Filtering threshold: 0.25',fontsize=9,color='#58636b');ax.grid(axis='y');ax.set_title('Scores for all retained predictions, including wrong and extra boxes')
 save(fig,'canonical-confidence')

if __name__=='__main__':
 samples();color();architecture();cases();confusion();performance();batches();confidence()
 (ROOT/'assets-local.json').write_text(json.dumps(receipts,indent=2)+'\n')
 for name in ['summary.json','independent-verification.json','paired-image-outcomes.json']:
  (ROOT/name).write_bytes((EXP/'evaluation'/name).read_bytes())
