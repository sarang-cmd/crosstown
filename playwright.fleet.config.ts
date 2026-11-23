import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'fleet.spec.ts',timeout:600000,outputDir:'.arena/fleet-results',reporter:[['list'],['json',{outputFile:'.arena/fleet-results.json'}]],use:{...base.use,actionTimeout:60000,viewport:{width:960,height:540}},projects:base.projects!.filter(p=>p.name!=='webgpu-disabled')});
