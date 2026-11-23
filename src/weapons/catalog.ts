export const WEAPONS = [
 {id:'bat',name:'Boardwalk Bat',price:0,ammoPrice:0,magazine:1,reserve:0,interval:.48,reload:0,damage:34,spread:.04,recoil:.035,range:3,pellets:1,model:''},
 {id:'pistol',name:'Sidekick Pistol',price:250,ammoPrice:35,magazine:12,reserve:48,interval:.24,reload:1.35,damage:26,spread:.015,recoil:.055,range:100,pellets:1,model:'weapon-pistol'},
 {id:'smg',name:'Switchback SMG',price:650,ammoPrice:65,magazine:30,reserve:120,interval:.085,reload:1.7,damage:15,spread:.045,recoil:.028,range:80,pellets:1,model:'weapon-smg'},
 {id:'shotgun',name:'Breakwater Shotgun',price:800,ammoPrice:55,magazine:6,reserve:24,interval:.8,reload:2.1,damage:13,spread:.12,recoil:.11,range:48,pellets:8,model:'weapon-shotgun'},
 {id:'rifle',name:'Ridgeline Rifle',price:1200,ammoPrice:85,magazine:20,reserve:80,interval:.14,reload:1.9,damage:36,spread:.009,recoil:.065,range:180,pellets:1,model:'weapon-rifle'},
 {id:'grenade',name:'Fizzy Grenade',price:450,ammoPrice:110,magazine:1,reserve:4,interval:1.15,reload:.8,damage:90,spread:.018,recoil:.07,range:35,pellets:1,model:'weapon-grenade'},
 {id:'rocket',name:'Sunburst Launcher',price:2200,ammoPrice:180,magazine:1,reserve:3,interval:1.2,reload:2.7,damage:140,spread:.012,recoil:.15,range:160,pellets:1,model:'weapon-rocket'},
] as const;
export type WeaponId = typeof WEAPONS[number]['id'];
export type WeaponDefinition = typeof WEAPONS[number];
export const weapon = (id:string):WeaponDefinition => WEAPONS.find(w=>w.id===id)??WEAPONS[0];
