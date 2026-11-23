#!/usr/bin/env python3
"""12 replaceable per-car loop sets, derived from the six reviewed recordings.
Distinct EQ/saturation/harmonic design, not a claim of 12 recorded real engines.
Retains older cabin studies and Harbor loops byte-for-byte.
"""
from pathlib import Path
import json,hashlib
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfiltfilt
ROOT=Path(__file__).resolve().parent.parent
# car, reviewed base folder, lowpass, drive saturation, designed harmonic blend
SETS=[('pip','cabin-compact',6500,1.2,0),('milo','cabin-compact',2900,1.5,0),('meridian','harbor',6200,1.2,.08),('brim','cabin-muscle',2500,2.0,.06),('cinder','cabin-muscle',6800,2.9,.12),('aerox','cabin-supercar',7200,1.3,.05),('zenith','cabin-supercar',8800,1.5,.18),('mesa','cabin-suv',2400,2.4,.04),('summit','cabin-suv',4100,1.8,.07),('wren','cabin-motorbike',5100,2.7,.05),('kestrel','cabin-motorbike',7600,1.8,.25)]
reports=[]
for car,base,cutoff,drive,harmonic in SETS:
 source=ROOT/'public/audio/cars'/base;target=ROOT/'public/audio/cars'/car;target.mkdir(parents=True,exist_ok=True)
 manifest=json.loads((source/'manifest.json').read_text());records=[]
 for record in manifest['loops']:
  a,rate=sf.read(source/record['file']); b=sosfiltfilt(butter(2,[48,cutoff],btype='bandpass',fs=rate,output='sos'),a)
  b=np.tanh(b*drive)/drive
  # Phase-aligned recorded signal harmonic, not an independent sample source.
  b=(1-harmonic)*b+harmonic*np.sin(b*9)*.14
  edge=int(rate*.003);fade=(1-np.cos(np.linspace(0,np.pi,edge)))/2;b-=np.linspace(b[0],b[-1],len(b));b[:edge]*=fade;b[-edge:]*=fade[::-1]
  b*=.12/max(1e-7,np.sqrt(np.mean(b*b)));b*=min(1,.88/max(abs(b)))
  path=target/record['file'];sf.write(path,b,rate,subtype='PCM_16');data=path.read_bytes()
  records.append({**record,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'derivation':{'baseProfile':base,'baseFileSha256':record['sha256'],'lowpassHz':cutoff,'saturation':drive,'designedHarmonicBlend':harmonic},'rms':float(np.sqrt(np.mean(b*b))),'peak':float(max(abs(b))),'seamDelta':float(abs(b[0]-b[-1]))})
 manifest={**manifest,'id':car,'engine': 'v10' if car=='zenith' else 'twin' if car=='kestrel' else manifest['engine'],'baseProfile':base,'notes':manifest['notes']+' Per-car EQ/saturation/harmonic design. V10 and twin timbres are designed transformations of the reviewed flat-six/single recordings, not independently recorded cylinder counts.','loops':records}
 (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');reports.append(manifest)
reports.append(json.loads((ROOT/'public/audio/cars/harbor/manifest.json').read_text()))
(ROOT/'docs/ROSTER-AUDIO-ASSETS.json').write_text(json.dumps({'date':'2026-11-22','profiles':reports,'totalLoops':sum(len(p['loops']) for p in reports),'limitations':['Six reviewed field recordings underpin twelve designed car profiles. Not twelve independent dyno recordings.','V10 and twin use harmonic transformations; human listening/realism acceptance remains necessary.']},indent=2)+'\n')
print('Prepared 12 independent replacement folders,',sum(len(p['loops']) for p in reports),'loops; original Harbor and cabin studies retained.')
