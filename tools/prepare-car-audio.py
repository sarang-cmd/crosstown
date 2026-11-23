#!/usr/bin/env python3
"""Prepare reviewed CC0/CC-BY real recordings into small, periodic browser loops.
No audio library is shipped in the game. This optional offline tool uses numpy/scipy/soundfile.
Original publisher pages and downloaded public HQ MP3 previews are retained under assets/.
Load states are designed derivatives, NOT calibrated dyno recordings at verified RPM/load.
"""
from pathlib import Path
import json, hashlib, math
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, butter, sosfiltfilt
ROOT = Path(__file__).resolve().parent.parent
RATE=32000
PROFILES = {
 'i4': {'folder':'cabin-compact','windows':[23,26,29,32],'anchors':[850,2000,3800,5700]},
 'v6': {'folder':'harbor','windows':[10,25,42,55],'anchors':[820,2000,3800,5800]},
 'v8': {'folder':'cabin-muscle','windows':[0.15,2.0,3.5,6.1],'anchors':[730,1800,3400,5200]},
 'flat6': {'folder':'cabin-supercar','windows':[0.2,2.0,3.8,6.5],'anchors':[1050,2600,5000,7500]},
 'diesel': {'folder':'cabin-suv','windows':[0.15,3.4,6.5,10],'anchors':[760,1400,2600,4000]},
 'single': {'folder':'cabin-motorbike','windows':[0.1,1.1,2.3,3.7],'anchors':[1300,3000,5500,8000]},
}
all_reports=[]
for engine,p in PROFILES.items():
 source=ROOT/'assets/audio-sources'/f'{engine}.mp3'
 meta_path=source.with_suffix('.json');meta=json.loads(meta_path.read_text())
 digest=hashlib.sha256(source.read_bytes()).hexdigest()
 if meta.get('sha256') and meta['sha256']!=digest: raise ValueError(f'Changed reviewed source: {engine}')
 meta['sha256']=digest
 meta['license']='CC-BY-3.0' if engine in ('i4','single') else 'CC-BY-4.0' if engine=='v6' else 'CC0-1.0'
 meta['sourceFormat']='Publisher public HQ MP3 preview (lossy), not the login-only original WAV.'
 meta['modifications']='Mono downmix, 32 kHz resample, DC/high/low filtering, RMS normalization, periodic crossfade, designed load/RPM layers.'
 meta_path.write_text(json.dumps(meta,indent=2)+'\n')
 if meta['license'] not in ('CC0-1.0','CC-BY-3.0','CC-BY-4.0'):raise ValueError('Unapproved licence')
 a,sr=sf.read(source,dtype='float32');a=a.mean(axis=1) if a.ndim==2 else a
 if sr!=RATE:a=resample_poly(a,RATE//math.gcd(sr,RATE),sr//math.gcd(sr,RATE))
 target=ROOT/'public/audio/cars'/p['folder'];target.mkdir(parents=True,exist_ok=True)
 loops=[]
 for index,band in enumerate(['idle','low','mid','high']):
  n=int(RATE*1.25);overlap=int(RATE*0.08);start=min(int(p['windows'][index]*RATE),len(a)-n-overlap-1)
  if start<0:raise ValueError('Source too short')
  raw=a[start:start+n+overlap].astype(np.float64)
  for load in ['off','on']:
   cutoff=1600 if load=='off' else 5800
   filtered=sosfiltfilt(butter(3,[48,cutoff],btype='bandpass',fs=RATE,output='sos'),raw)
   b=filtered[:n].copy();f=(1-np.cos(np.linspace(0,np.pi,overlap)))/2
   b[:overlap]=filtered[n:n+overlap]*(1-f)+filtered[:overlap]*f
   # Tiny DC correction makes endpoints equal. A 2 ms raised-cosine edge makes
   # their slopes approach zero too; no hard sample step at the repeat boundary.
   b-=np.linspace(b[0],b[-1],len(b));edge=int(RATE*.002);fade=(1-np.cos(np.linspace(0,np.pi,edge)))/2;b[:edge]*=fade;b[-edge:]*=fade[::-1]
   rms=float(np.sqrt(np.mean(b*b)));b*=.12/max(rms,1e-5);b*=min(1,.88/max(float(np.max(np.abs(b))),1e-6))
   name=f'{band}-{load}.wav';sf.write(target/name,b,RATE,subtype='PCM_16')
   decoded,rate=sf.read(target/name);data=(target/name).read_bytes()
   loops.append({'band':band,'load':load,'file':name,'anchorRpm':p['anchors'][index],'anchorIsDesignedNotMeasured':True,'sourceStartSeconds':start/RATE,'duration':len(decoded)/rate,'rms':float(np.sqrt(np.mean(decoded**2))),'seamDelta':float(abs(decoded[0]-decoded[-1])),'peak':float(np.max(np.abs(decoded))),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 manifest={'version':1,'id':p['folder'],'engine':engine,'source':meta['source'],'author':meta['author'],'license':meta['license'],'licenseUrl':meta['licenses'][0],'notes':'Processed field-recording timbre plus firing-model synthesis. These are designed RPM/load anchors, not independent calibrated on/off-throttle dyno captures.','loops':loops}
 (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');all_reports.append(manifest)
 (ROOT/'docs/assets'/f'audio-{engine}.license.txt').write_text(f"Reviewed 2026-11-22\n{meta['author']}\n{meta['source']}\n{meta['license']}\n{meta['licenses'][0]}\nSource SHA-256: {digest}\n{meta['sourceFormat']}\nModifications: {meta['modifications']}\nNo endorsement by the original vehicle manufacturer. Source brand names occur only in provenance.\n")
report={'date':'2026-11-22','sampleRate':RATE,'format':'mono PCM16 WAV','sources':len(all_reports),'loops':sum(len(r['loops']) for r in all_reports),'allSeamsEqual':all(l['seamDelta']<1/32768 for r in all_reports for l in r['loops']),'totalBytes':sum(l['bytes'] for r in all_reports for l in r['loops']),'profiles':all_reports,'limits':['Source recordings are lossy publisher previews; no login or access control was bypassed.','RPM and off/on load layers are processed derivatives. No calibrated multiple-load dyno set is claimed.','Numerical seam continuity does not substitute for a human listening comparison.']}
(ROOT/'docs/CAR-AUDIO-ASSETS.json').write_text(json.dumps(report,indent=2)+'\n')
print(f"Prepared {report['sources']} real recording profiles / {report['loops']} periodic loops / {report['totalBytes']:,} bytes; all seam deltas < 1 LSB: {report['allSeamsEqual']}")

# Keep generated asset credits durable across either model or audio preparation.
import subprocess
subprocess.run(['node','--input-type=module','-e',"import {writeCredits} from './tools/credits.mjs'; await writeCredits(process.cwd());"],cwd=ROOT,check=True)
