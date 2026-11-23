// Original bounded arcade foley. No sampled weapons, third-party recordings or
// violent realism; seven envelopes have different pitch / noise / duration.
import type { ParkourAudio } from './parkour-audio';
import type { WeaponId } from '../weapons/catalog';
export class CombatAudio {
 private noise?:AudioBuffer;private active=0;
 constructor(readonly audio:ParkourAudio){}
 play(id:WeaponId|'reload'|'explosion'):void{const c=this.audio.context,bus=this.audio.effectsBus;if(!c||!bus||c.state!=='running'||this.active>=12)return;if(!this.noise){this.noise=c.createBuffer(1,Math.floor(c.sampleRate*.7),c.sampleRate);const s=this.noise.getChannelData(0);let seed=58129;for(let i=0;i<s.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;s[i]=seed/2147483648-1;}}
  const config={bat:[95,.14,.11,750],pistol:[240,.13,.10,2800],smg:[340,.07,.075,4300],shotgun:[120,.30,.14,1400],rifle:[390,.18,.10,3400],grenade:[610,.17,.05,900],rocket:[145,.42,.11,700],reload:[650,.10,.045,3800],explosion:[55,.60,.15,650]}[id]!,[pitch,duration,volume,cutoff]=config as[number,number,number,number],t=c.currentTime,g=c.createGain(),filter=c.createBiquadFilter(),noise=c.createBufferSource(),osc=c.createOscillator();noise.buffer=this.noise;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,t);filter.frequency.exponentialRampToValueAtTime(120,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);noise.connect(filter);osc.type='triangle';osc.frequency.setValueAtTime(pitch,t);osc.frequency.exponentialRampToValueAtTime(40,t+duration);osc.connect(filter);filter.connect(g).connect(bus);noise.start(t);osc.start(t);noise.stop(t+duration);osc.stop(t+duration);this.active++;osc.onended=()=>{this.active--;osc.disconnect();noise.disconnect();filter.disconnect();g.disconnect();};
 }
 snapshot(){return{activeVoices:this.active,limit:12,source:'original procedural Web Audio'};}
}
