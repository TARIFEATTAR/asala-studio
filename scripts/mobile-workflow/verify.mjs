// Local UI acceptance with synthetic records. All remote traffic is intercepted.
// Usage: MOBILE_BASE_URL=http://127.0.0.1:5186 node scripts/mobile-workflow/verify.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
const env = Object.assign({}, ...['.env','.env.local'].filter(fs.existsSync).map(file => dotenv.parse(fs.readFileSync(file))));
const base = process.env.MOBILE_BASE_URL || 'http://127.0.0.1:5186';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Use a local preview');
const out = path.join(os.tmpdir(), 'madison-mobile-qa');fs.mkdirSync(out,{recursive:true});
const user = {id:'11111111-1111-4111-8111-111111111111',email:'preview@example.test',role:'authenticated',aud:'authenticated',app_metadata:{},user_metadata:{}};
const org='22222222-2222-4222-8222-222222222222';
let master={id:'33333333-3333-4333-8333-333333333333',organization_id:org,title:'A thoughtful ritual for autumn mornings',content_type:'blog_article',full_content:'A thoughtful ritual for autumn mornings.\n\n'+ 'Begin with a quiet moment. Discover our warm botanical fragrance, composed with care for everyday rituals. '.repeat(8),word_count:150,is_archived:false};
const requests=[];let writes=0; let imageCount=0; let failNextImage=false; let failNextEditionSave=false; let editionRecords=[]; let editionSaveGate=null;
const secondMaster={...master,id:"44444444-4444-4444-8444-444444444444",title:"Second source for return navigation"};
const previewImage=`${base}/__mobile_fixture.jpg`;
const imageBuffer=fs.readFileSync('src/assets/vanity-table-hero.jpg');
const browser=await chromium.launch({headless:true,channel:process.env.MOBILE_BROWSER_CHANNEL || 'chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write']});
await context.addInitScript(({key,user})=>localStorage.setItem(key,JSON.stringify({access_token:'preview-only-token',refresh_token:'preview-only-refresh',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user})),{key:`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`,user});
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.pathname==='/__mobile_fixture.jpg') return route.fulfill({contentType:'image/jpeg',body:imageBuffer});
 if(u.pathname.includes('/functions/v1/')) {
  const name=u.pathname.split('/').pop(),body=req.postDataJSON()||{};requests.push({name,body});
  if(name==='generate-with-claude') {
   const pack={themes:['ritual'],mood:'quiet',colorPalette:['#b8956a'],visualElements:['stone'],surfaces:['stone'],actions:[],atmosphere:'calm',suggestedVisualMaster:'PENN_STILL_LIFE',...Object.fromEntries(['hero','social','emailHeader'].map(key=>[key,{prompt:'Botanical fragrance on stone',aspectRatio:'1:1',purpose:key}]))};
   return route.fulfill({json:{generatedContent:body.contentType?master.full_content:JSON.stringify(pack)}});
  }
  if(name==='repurpose-content'){editionRecords=body.derivativeTypes.map((type,index)=>({id:`edition-${index}`,organization_id:org,asset_type:type,generated_content:'A new moment to pause. '+master.full_content,approval_status:'pending',master_content_id:master.id}));return route.fulfill({json:{success:true,derivatives:editionRecords}});}
  if(name==='generate-madison-image'){
   if(failNextImage){failNextImage=false;return route.fulfill({status:429,json:{error:'Rate limit reached. Please try again.'}});}
   imageCount++;return route.fulfill({json:{imageUrl:previewImage,savedImageId:`image-${imageCount}`}});
  }
  return route.fulfill({json:{success:true}});
 }
 if(u.pathname.includes('/auth/v1/'))return route.fulfill({json:user});
 if(u.pathname.includes('/rest/v1/')){
  const table=u.pathname.split('/').pop(),object=(req.headers().accept||'').includes('object');let data=[];
  if(req.method()!=='GET'&&req.method()!=='HEAD'){writes++;if(table==='master_content')master={...master,...req.postDataJSON()};}
  if(table==='derivative_assets'){
   const id=u.searchParams.get('id')?.replace(/^eq\./,'');
   if(req.method()==='PATCH'){
    if(editionSaveGate) await editionSaveGate;
    if(failNextEditionSave){failNextEditionSave=false;return route.fulfill({status:500,json:{message:'Synthetic save failure'}});}
    editionRecords=editionRecords.map(record=>record.id===id?{...record,...req.postDataJSON()}:record);
   }
   data=editionRecords.filter(record=>!id||record.id===id);
  }
  if(table==='master_content'){const id=u.searchParams.get('id')?.replace(/^eq\./,'');data=[master,secondMaster].filter(record=>!id||record.id===id);}
  if(table==='generated_images')data=[{id:'fixture-library-image',image_url:previewImage,session_name:'Preview photograph',session_id:null,goal_type:'product_photography',aspect_ratio:'1:1',final_prompt:'A fragrance still life',library_category:'product',library_tags:[],is_hero_image:false,created_at:'2026-09-01T12:00:00Z',is_archived:false}];
  if(table==='organization_members')data=[{organization_id:org,user_id:user.id,role:'owner'}];
  if(table==='organizations')data=[{id:org,name:'Preview organization',settings:{},brand_config:{},onboarding_completed:true}];
  if(table==='profiles')data=[{id:user.id,full_name:'Preview',onboarding_completed:true}];
  return route.fulfill({json:object?(data[0]??null):data});
 }
 if(u.origin===new URL(base).origin)return route.continue();
 return route.fulfill({json:{}});
});
const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000); const errors=[];page.on('pageerror',error=>errors.push(error.message));
const shot=async name=>{
 for(const close of await page.locator('[toast-close]:visible').all()) { await close.click({timeout:1000}).catch(()=>{}); }
 await page.waitForTimeout(250);
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:false,timeout:10000,animations:'disabled'});
};
const fit=async name=>{
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: document overflow`);
 const clipped=await page.locator('button:visible,[role="combobox"]:visible').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!node.closest('[data-radix-scroll-area-viewport]');}).map(n=>({text:n.textContent?.slice(0,60),label:n.getAttribute('aria-label'),class:n.className})));
 assert.deepEqual(clipped,[],`${name}: clipped controls`);
 const dialogs=await page.locator('[role=dialog]:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};}));
 assert(dialogs.every(r=>r.top>=-1&&r.bottom<=r.height+1),`${name}: dialog outside viewport ${JSON.stringify(dialogs)}`);
};
try {
 console.log('Create → editor'); await page.goto(base+'/create');
 await page.getByRole('button',{name:'Instagram Post',exact:true}).click();
 await page.getByLabel('What would you like to say?').fill('Introduce a quiet autumn morning ritual.');
 await shot('create-brief'); await page.getByRole('button',{name:'Generate Instagram Post',exact:true}).click();
 await page.waitForURL('**/editor'); await page.getByRole('button',{name:'Multiply',exact:true}).waitFor();
 assert.equal(await page.locator('.tiptap').textContent(),master.full_content.replace(/\n/g,''));
 await fit('editor');await shot('editor');
 await page.locator('.tiptap').fill('Edited on a phone. A quiet autumn morning ritual.');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Multiply',exact:true}).click();
 console.log('Multiply'); await page.waitForURL('**/multiply**');
 await page.getByText('Read source content',{exact:true}).click();
 await page.getByLabel('Instagram',{exact:true}).check();
 await page.getByLabel('Product Description',{exact:true}).check();
 await page.getByRole('button',{name:'Generate 2 editions',exact:true}).click();
 await page.getByRole('button',{name:'View 2 generated editions'}).click();
 await page.getByRole('button',{name:'Read edition',exact:true}).first().click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Edition content').fill('Edited derivative on mobile.');
 await page.waitForTimeout(300); await fit('edition dialog');await shot('edition-dialog');
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await page.getByRole('button',{name:'Close edition',exact:true}).click();
 await page.getByRole('button',{name:'Edit edition',exact:true}).first().click();
 await fit('derivative editor');await shot('derivative-editor');
 await page.locator('.mobile-derivative-editor textarea').first().fill('Saved through the edition editor.');
 failNextEditionSave=true;
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await page.getByText("Couldn't save changes",{exact:true}).waitFor();
 assert.notEqual(editionRecords[0].generated_content,'Saved through the edition editor.');
 assert.equal(await page.locator('.mobile-derivative-editor textarea').first().inputValue(),'Saved through the edition editor.');
 let releaseSave;editionSaveGate=new Promise(resolve=>{releaseSave=resolve;});
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await page.locator('.mobile-derivative-editor[disabled]').waitFor();
 assert(await page.locator('.mobile-derivative-editor textarea').first().isDisabled(),'Draft editing pauses during save');
 assert(await page.getByRole('button',{name:'Exit Editor',exact:true}).isDisabled(),'Navigation pauses during save');
 releaseSave();editionSaveGate=null;
 await page.waitForFunction(()=>[...document.querySelectorAll('.mobile-derivative-editor button')].some(button=>button.textContent.includes('Save Changes')&&!button.disabled));
 assert.equal(editionRecords[0].generated_content,'Saved through the edition editor.');
 await shot('edition-saved');
 await page.getByRole('button',{name:'Exit Editor',exact:true}).click();
 await page.getByRole('button',{name:'Read edition',exact:true}).first().click();
 await page.getByRole('dialog').getByText('Saved through the edition editor.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close edition',exact:true}).click();
 await page.getByText('Create visual prompts',{exact:true}).click();
 await page.getByLabel('Image Pack',{exact:true}).check();
 await page.getByRole('button',{name:'Generate visual prompts',exact:true}).click();
 await page.getByText('Hero Image',{exact:true}).last().waitFor();
 await page.getByRole('button',{name:'Generate',exact:true}).first().click();
 await page.waitForURL('**/darkroom?prompt=*');
 assert.equal(await page.getByLabel('Describe your image').inputValue(),'Botanical fragrance on stone');
 await page.goBack();
 await page.getByText('Hero Image',{exact:true}).last().waitFor();
 await page.getByText('Social Post',{exact:true}).last().waitFor();
 await page.getByRole('button',{name:'Read edition',exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Generate',exact:true}).count(),3);
 await page.getByRole('button',{name:'Generate',exact:true}).nth(1).click();
 await page.waitForURL('**/darkroom?prompt=*');
 console.log('Dark Room');
 await page.getByLabel('Describe your image').fill('Botanical fragrance on stone');
 await page.getByLabel('Describe your image').press('Enter');
 assert.equal(imageCount,0,'Return must insert a newline, not generate');
 await page.getByRole('button',{name:/^Size/}).click();
 await page.getByRole('dialog').waitFor();await fit('size sheet');await shot('size-sheet');
 const options=page.getByRole('dialog').getByRole('button',{pressed:false});await options.first().click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 // Error and retry keep the prompt available.
 failNextImage=true;await page.getByRole('button',{name:'Generate Image',exact:true}).click();
 await page.getByRole('button',{name:'Generate Image',exact:true}).waitFor();
 await page.waitForTimeout(300);
 assert((await page.getByLabel('Describe your image').inputValue()).includes('Botanical'));
 await page.getByRole('button',{name:'Generate Image',exact:true}).click();
 await page.getByRole('button',{name:'Open image preview',exact:true}).waitFor();
 await page.getByRole('button',{name:'Open image preview',exact:true}).click();
 await page.getByRole('button',{name:'Refine',exact:true}).click();
 console.log('Light Table'); await page.waitForURL('**/light-table');await page.getByRole('heading',{name:'Light Table',exact:true}).waitFor();await fit('light table');await shot('light-table');
 const beforeRefine=imageCount;
 await page.getByPlaceholder('Short edit only, e.g. soften the contact shadow and clean the cream background').fill('Soften the contact shadow');
 await page.getByRole('button',{name:'Refine Image',exact:true}).click();
 await page.getByRole('button',{name:'Refine Image',exact:true}).waitFor();
 assert.equal(imageCount,beforeRefine+1);
 const refinement=requests.filter(r=>r.name==='generate-madison-image').at(-1).body;
 assert.equal(refinement.goalType,'refinement');assert.equal(refinement.referenceImages[0].url,previewImage);
 console.log('Source switching and return navigation');
 await page.goto(base+'/multiply?id='+master.id);
 await page.getByRole('combobox',{name:'Master Content:'}).click();
 await page.getByRole('option',{name:/Second source for return navigation/}).click();
 await page.getByText('Create visual prompts',{exact:true}).click();
 await page.getByLabel('Image Pack',{exact:true}).check();
 await page.getByRole('button',{name:'Generate visual prompts',exact:true}).click();
 await page.getByText('Hero Image',{exact:true}).last().waitFor();
 await page.getByRole('button',{name:'Generate',exact:true}).first().click();
 await page.waitForURL('**/darkroom?prompt=*');
 await page.getByLabel('Describe your image').waitFor();await page.goBack();
 await page.getByText('Hero Image',{exact:true}).last().waitFor();
 assert.equal(new URL(page.url()).searchParams.get('id'),secondMaster.id);
 await page.waitForFunction(()=>!history.state?.usr?.multiplyWorkspace);
 assert.equal(await page.evaluate(()=>history.state?.usr?.multiplyWorkspace),undefined,'Return snapshot is consumed');
 await page.getByRole('combobox',{name:'Master Content:'}).click();
 await page.getByRole('option',{name:new RegExp(master.title)}).click();
 await page.getByRole('combobox',{name:'Master Content:'}).click();
 await page.getByRole('option',{name:/Second source for return navigation/}).click();
 assert.equal(await page.getByText('Hero Image',{exact:true}).count(),0,'Old snapshots must not replay');
 console.log('Viewport matrix'); for(const width of [360,390,430,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  for(const route of ['create','multiply','image-editor','image-library']){
   await page.goto(base+'/'+route);await page.waitForTimeout(800);await fit(`${route} ${width}`);await shot(`${route}-${width}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/image-editor');
 await page.getByRole('button',{name:'Custom Prompt',exact:true}).click();
 await page.getByLabel('Describe Your Image').fill('A bottle in soft window light');
 await page.getByLabel('Upload reference image').setInputFiles({name:'reference.jpg',mimeType:'image/jpeg',buffer:imageBuffer});
 await page.getByRole('button',{name:'Remove reference image'}).waitFor();
 await fit('image setup');await shot('image-setup');
 await page.setViewportSize({width:390,height:400});await fit('short image setup');
 await page.getByLabel('Describe Your Image').fill('A bottle in soft window light');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Close image setup'}).click();
 await page.getByRole('button',{name:'Custom Prompt',exact:true}).click();
 assert.equal(await page.getByLabel('Describe Your Image').inputValue(),'A bottle in soft window light');
 await page.getByRole('button',{name:'Generate Image',exact:true}).click();
 await page.getByRole('button',{name:'Save image',exact:true}).waitFor();
 const attachment=requests.filter(r=>r.name==='generate-madison-image').at(-1).body.referenceImages;assert(attachment?.length>0,'Uploaded reference must reach generation');assert(attachment[0].url.startsWith('data:image/'));
 await fit('image result');await shot('image-result');
 await page.getByText('Create a variation',{exact:true}).click();
 await page.getByLabel('Image description').fill('A bottle in warm evening light');
 await page.getByRole('button',{name:'Square 1:1'}).click();
 await page.getByRole('button',{name:'Generate variation'}).click();
 await page.getByRole('button',{name:'Save image',exact:true}).waitFor();
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download image',exact:true}).click();
 assert(await (await downloadPromise).path());
 await page.getByRole('button',{name:'Save image',exact:true}).click();
 await page.getByRole('tab',{name:/Gallery/}).waitFor();
 await page.goto(base+'/image-library');
 await page.getByLabel('Search images').fill('Preview photograph');
 await page.getByRole('button',{name:'Open Preview photograph',exact:true}).click();
 await page.getByRole('dialog').waitFor();await fit('library editor');await shot('library-editor');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({ok:true,writes,imageCount,widths:[360,390,430,768,1024,1440],screenshots:out,functions:[...new Set(requests.map(x=>x.name))]},null,2));
} catch(error){await shot('failure');console.log((await page.locator('body').innerText()).slice(-3500));throw error;}
finally {await browser.close();}
