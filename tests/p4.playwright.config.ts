import { defineConfig } from '@playwright/test'
import base from '../playwright.config.js'
export default defineConfig({...base,testDir:'./e2e',outputDir:'../test-results/p4',reporter:[['list'],['html',{open:'never',outputFolder:'../playwright-report/p4'}]],projects:base.projects?.map(project=>({...project,use:{...project.use,baseURL:project.name==='auth'?'http://127.0.0.1:5384':project.name==='production'?'http://127.0.0.1:4383':'http://127.0.0.1:5383'},...(project.name==='auth'?{testMatch:['auth.spec.ts','p3.spec.ts','p4.spec.ts']}:{})}))})
