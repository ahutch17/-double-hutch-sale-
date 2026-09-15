const APP_VERSION = '2.0.0-cloud';
const sampleItems = [
  {id:'sample-1',name:'Chunky Crochet Throw',price:38,cat:'Handmade & Homegrown',type:'crochet',fulfill:'Pickup or shipping',status:'Available',desc:'A soft, handmade throw in a warm neutral color. One currently available.'},
  {id:'sample-2',name:'Women’s Linen Shirt',price:12,cat:'Clothing',type:'clothing',fulfill:'Pickup or shipping',status:'Available',desc:'Gently used linen blend shirt in excellent condition.'},
  {id:'sample-3',name:'Wooden Side Table',price:24,cat:'Everyday Items',type:'everyday',fulfill:'Local pickup',status:'Available',desc:'Compact wooden side table with a warm natural finish.'},
  {id:'sample-4',name:'Paracord Keychain Set',price:10,cat:'Handmade & Homegrown',type:'crochet',fulfill:'Pickup or shipping',status:'Pending',desc:'Handmade paracord keychain set. This one is currently pending.'},
  {id:'sample-5',name:'Kids Rain Jacket',price:8,cat:'Clothing',type:'clothing',fulfill:'Pickup or shipping',status:'Available',desc:'Lightweight kids rain jacket, gently used.'},
  {id:'sample-6',name:'Farm Stand Herb Bundle',price:6,cat:'Handmade & Homegrown',type:'crochet',fulfill:'Local pickup',status:'Available',desc:'Fresh seasonal herb bundle, while available.'},
  {id:'sample-7',name:'Woven Storage Basket',price:14,cat:'Everyday Items',type:'everyday',fulfill:'Local pickup',status:'Available',desc:'Neutral woven basket for toys, blankets, or household storage.'},
  {id:'sample-8',name:'Crochet Market Bag',price:22,cat:'Handmade & Homegrown',type:'crochet',fulfill:'Pickup or shipping',status:'Request',desc:'Handmade crochet market bag available by request.'}
];

let items = [...sampleItems];
let cart = [];
let current = items[0];
let shopSearch = '';
let claimMethod = 'pickup';
let cloudProductsLoaded = false;
let adminUser = null;
let claimsUnsubscribe = null;
let claimRows = [];
let editingProductId = null;
const cloud = window.DoubleHutchCloud || { ready: false };

function money(n){ return '$' + Number(n || 0).toFixed(2); }
function clean(value){ return String(value ?? '').trim(); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeId(value){ return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, ''); }

function productCard(x){
  const action = x.status === 'Pending' ? 'Claim Next' : x.status === 'Request' ? 'Request item' : 'Add to cart';
  const id = safeId(x.id);
  const photoStyle = x.imageUrl ? ` style="background-image:url('${escapeHtml(x.imageUrl)}');background-size:cover;background-position:center"` : '';
  const shape = x.imageUrl ? '' : '<div class="shape"></div>';
  const click = x.status === 'Pending' ? `toast('You are next in line for ${escapeHtml(x.name)}')` : x.status === 'Request' ? `openProduct('${id}')` : `quickAdd('${id}')`;
  return `<article class="card"><button class="productPhotoButton" onclick="openProduct('${id}')"><div class="photo ${escapeHtml(x.type || 'everyday')}"${photoStyle}><span class="badge ${x.status === 'Pending' ? 'pending' : ''}">${escapeHtml(x.status || 'Available')}</span>${shape}</div></button><div class="cardbody"><div class="meta"><h3>${escapeHtml(x.name)}</h3><span class="price">${money(x.price)}</span></div><div class="fulfill">${escapeHtml(x.fulfill || 'Pickup or shipping')}</div><button class="smallbtn" onclick="${click}">${action}</button></div></article>`;
}

function renderProducts(){
  const home = document.getElementById('homeProducts');
  if (home) home.innerHTML = items.slice(0,4).map(productCard).join('');
  let list = [...items];
  const cat = document.getElementById('categoryFilter')?.value;
  if (cat && cat !== 'All categories') list = list.filter(x => x.cat === cat);
  const fulfill = document.getElementById('fulfillFilter')?.value;
  if (fulfill === 'Shipping available') list = list.filter(x => (x.fulfill || '').toLowerCase().includes('shipping'));
  if (fulfill === 'Local pickup') list = list.filter(x => (x.fulfill || '').toLowerCase().includes('pickup'));
  if (shopSearch) list = list.filter(x => `${x.name} ${x.cat}`.toLowerCase().includes(shopSearch.toLowerCase()));
  const shop = document.getElementById('shopProducts');
  if (shop) shop.innerHTML = list.length ? list.map(productCard).join('') : '<div class="empty">No items match those filters.</div>';
  renderAdminInventory();
}

function showView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === id));
  document.querySelector('.wrap')?.scrollTo({top:0,behavior:'smooth'});
  window.scrollTo({top:0,behavior:'smooth'});
  if (id === 'cart') renderCart();
  if (id === 'admin' && !adminUser) showAdminGate();
}

function filterShop(cat){ showView('shop'); document.getElementById('categoryFilter').value = cat; renderProducts(); }
function findItem(id){ return items.find(x => String(x.id) === String(id)); }
function openProduct(id){
  current = findItem(id) || items[0];
  if (!current) return;
  document.getElementById('detailCat').textContent = current.cat;
  document.getElementById('detailName').textContent = current.name;
  document.getElementById('detailPrice').textContent = money(current.price);
  document.getElementById('detailDesc').textContent = current.desc || '';
  document.getElementById('detailAdd').textContent = current.status === 'Pending' ? 'Claim Next' : current.status === 'Request' ? 'Send item request' : 'Add to cart';
  showView('product');
}
function selectChoice(el){ el.parentElement.querySelectorAll('.choice').forEach(x => x.classList.remove('selected')); el.classList.add('selected'); }
function quickAdd(id){ const x = findItem(id); if (!x) return; cart.push(x); updateCount(); toast(`${x.name} added to cart`); }
function addCurrentToCart(){
  if (current.status === 'Pending'){ toast(`You are next in line for ${current.name}`); return; }
  if (current.status === 'Request'){ toast('Item request opened — we’ll confirm it can be made'); return; }
  quickAdd(current.id); showView('cart');
}
function updateCount(){ document.getElementById('cartCount').textContent = cart.length; }
function removeCart(i){ cart.splice(i,1); updateCount(); renderCart(); }
function renderCart(){
  const box = document.getElementById('cartItems');
  if (!box) return;
  if (!cart.length) box.innerHTML = '<div class="empty"><h3>Your cart is ready for good finds.</h3><p>Add items, change your mind, and remove them anytime.</p><button class="btn" onclick="showView(\'shop\')">Start shopping</button></div>';
  else box.innerHTML = cart.map((x,i) => `<div class="cartitem"><div class="thumb"></div><div><h3>${escapeHtml(x.name)}</h3><div class="muted" style="font-size:13px">${escapeHtml(x.fulfill)}</div><button class="textbtn" onclick="removeCart(${i})">Remove</button></div><strong>${money(x.price)}</strong></div>`).join('');
  const sum = cart.reduce((a,x) => a + Number(x.price || 0), 0);
  document.getElementById('subtotal').textContent = money(sum);
  document.getElementById('total').textContent = money(sum);
}
function selectRadio(el){ el.parentElement.querySelectorAll('.radioCard').forEach(x => x.classList.remove('selected')); el.classList.add('selected'); }
function setMethod(el,method){
  selectRadio(el); claimMethod = method;
  document.getElementById('methodNote').textContent = method === 'pickup' ? 'We’ll contact you to arrange pickup. No pickups before 10 AM or from Friday 6 PM through Sunday 10 AM.' : 'We’ll calculate the actual label and packing-material cost, then email a PayPal invoice due within 24 hours.';
}

async function submitClaim(){
  if (!cart.length){ toast('Add at least one item before submitting a claim'); showView('cart'); return; }
  if (!cloud.ready){ toast('Cloud connection is unavailable. Please try again.'); return; }
  const view = document.getElementById('claim');
  const inputs = view.querySelectorAll('.field input');
  const name = clean(inputs[0]?.value);
  const email = clean(inputs[1]?.value).toLowerCase();
  const phone = clean(inputs[2]?.value);
  const message = clean(view.querySelector('textarea')?.value);
  const agreement = view.querySelector('label input[type="checkbox"]')?.checked;
  const updateChoice = clean(view.querySelector('.radioRow .radioCard.selected')?.textContent) || 'Email';
  if (name.length < 2 || !email.includes('@')){ toast('Please enter your name and email'); return; }
  if (!agreement){ toast('Please agree to the claim terms'); return; }
  const claimNumber = `DHS-${String(Date.now()).slice(-6)}`;
  const subtotal = cart.reduce((a,x) => a + Number(x.price || 0), 0);
  const claimItems = cart.map(x => ({id:String(x.id),name:x.name,price:Number(x.price || 0),fulfill:x.fulfill || ''}));
  const button = view.querySelector('button[onclick="submitClaim()"]');
  if (button){ button.disabled = true; button.textContent = 'Submitting…'; }
  try {
    await cloud.db.collection('claims').add({
      claimNumber,name,email,phone,updates:updateChoice,method:claimMethod,message,
      bundleRequested:document.getElementById('bundleCheck')?.checked === true,
      items:claimItems,subtotal,status:'Pending',createdAt:cloud.serverTimestamp()
    });
    cart = []; updateCount();
    document.querySelector('#claims .panel').innerHTML = `<h3>Claim submitted</h3><p>Your claim number is <strong>${claimNumber}</strong>.</p><p class="muted">Save this number. We’ll contact you at ${escapeHtml(email)} with the next steps.</p><button class="btn" onclick="showView('shop')">Keep shopping</button>`;
    showView('claims'); toast(`${claimNumber} submitted successfully`);
  } catch (error) {
    console.error(error); toast('Claim could not be submitted. Please try again.');
  } finally {
    if (button){ button.disabled = false; button.textContent = 'Submit claim'; }
  }
}

function ensureCloudUi(){
  const admin = document.querySelector('#admin .adminMain');
  if (admin && !document.getElementById('adminGate')){
    admin.insertAdjacentHTML('afterbegin', `<div id="adminGate" class="panel adminGate"><div class="eyebrow">Administrator access</div><h2>Sign in to manage the shop</h2><p class="muted">Only Amanda and Katie can open this area.</p><div class="field"><label>Email</label><input id="adminEmail" type="email" autocomplete="username"></div><div class="field"><label>Password</label><input id="adminPassword" type="password" autocomplete="current-password"></div><p id="adminLoginError" class="formError"></p><button class="btn block" onclick="loginAdmin()">Sign in</button><button class="smallbtn" style="margin-top:10px" onclick="showView('home')">Return to shop</button></div>`);
    admin.insertAdjacentHTML('beforeend', `<div id="adminCloudPanels" class="adminCloudPanels"><div class="panel"><div class="sectionhead"><div><h2 style="font-size:24px">Inventory</h2><p id="inventoryModeNote"></p></div><button class="linkbtn" onclick="openAddItem()">+ Add item</button></div><div id="adminInventory"></div></div><div class="panel"><div class="sectionhead"><div><h2 style="font-size:24px">Recent claims</h2></div></div><div id="adminClaims"><div class="empty">No claims yet.</div></div></div><button class="textbtn adminSignOut" onclick="logoutAdmin()">Sign out</button></div>`);
    document.querySelector('#admin .adminHeader .btn')?.setAttribute('onclick','openAddItem()');
    document.querySelector('#admin .taskgrid .panel:last-child .smallbtn')?.setAttribute('onclick','openAddItem()');
    const attentionPanel = document.querySelector('#admin .taskgrid .panel:first-child');
    if (attentionPanel) attentionPanel.innerHTML = `<div class="sectionhead" style="margin-bottom:5px"><div><h2 style="font-size:24px">Needs attention</h2></div><button class="linkbtn" onclick="scrollToRecentClaims()">View all</button></div><div id="needsAttention"><div class="empty">No pending claims.</div></div>`;
  }
  if (!document.getElementById('itemModal')){
    document.body.insertAdjacentHTML('beforeend', `<div id="itemModal" class="cloudModal" aria-hidden="true"><div class="cloudModalCard"><button class="modalClose" onclick="closeAddItem()" aria-label="Close">×</button><div class="eyebrow">Inventory</div><h2 id="itemModalTitle">Add an item</h2><div class="formGrid"><div class="field"><label>Item name</label><input id="newItemName"></div><div class="field"><label>Price</label><input id="newItemPrice" type="number" min="0" step="0.01"></div><div class="field"><label>Category</label><select id="newItemCategory"><option>Handmade & Homegrown</option><option>Clothing</option><option>Everyday Items</option></select></div><div class="field"><label>Availability</label><select id="newItemStatus"><option>Available</option><option>Pending</option><option>Request</option><option>Sold</option></select></div><div class="field"><label>Fulfillment</label><select id="newItemFulfill"><option>Pickup or shipping</option><option>Local pickup</option><option>Shipping available</option></select></div><div class="field"><label>Image URL (optional)</label><input id="newItemImage" type="url" placeholder="https://…"></div></div><div class="field"><label>Description</label><textarea id="newItemDesc" rows="3"></textarea></div><p id="itemFormError" class="formError"></p><button id="itemSaveButton" class="btn sage block" onclick="saveNewItem()">Save item</button></div></div>`);
  }
}

function setAdminLocked(locked){ document.querySelector('#admin .adminShell')?.classList.toggle('locked', locked); }
function showAdminGate(){ setAdminLocked(true); document.getElementById('adminGate')?.classList.add('show'); }
async function loginAdmin(){
  const email = clean(document.getElementById('adminEmail')?.value).toLowerCase();
  const password = document.getElementById('adminPassword')?.value || '';
  const errorBox = document.getElementById('adminLoginError');
  errorBox.textContent = '';
  if (!cloud.ready){ errorBox.textContent = 'Firebase is not connected.'; return; }
  if (!cloud.isAdminEmail(email)){ errorBox.textContent = 'This email is not approved for administrator access.'; return; }
  try { await cloud.auth.signInWithEmailAndPassword(email,password); }
  catch (error){ console.error(error); errorBox.textContent = 'The email or password did not match.'; }
}
async function logoutAdmin(){ if (cloud.ready) await cloud.auth.signOut(); showView('home'); }

function resetItemForm(){
  document.querySelectorAll('#itemModal input,#itemModal textarea').forEach(el => el.value = '');
  document.getElementById('newItemCategory').value = 'Handmade & Homegrown';
  document.getElementById('newItemStatus').value = 'Available';
  document.getElementById('newItemFulfill').value = 'Pickup or shipping';
  document.getElementById('itemFormError').textContent = '';
}
function openAddItem(){
  if (!adminUser){ showAdminGate(); return; }
  editingProductId = null; resetItemForm();
  document.getElementById('itemModalTitle').textContent = 'Add an item';
  document.getElementById('itemSaveButton').textContent = 'Save item';
  const modal = document.getElementById('itemModal'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
}
function openEditItem(id){
  if (!adminUser) return;
  const item = findItem(id); if (!item) return;
  editingProductId = String(item.id);
  document.getElementById('newItemName').value = item.name || '';
  document.getElementById('newItemPrice').value = Number(item.price || 0);
  document.getElementById('newItemCategory').value = item.cat || 'Everyday Items';
  document.getElementById('newItemStatus').value = item.status || 'Available';
  document.getElementById('newItemFulfill').value = item.fulfill || 'Pickup or shipping';
  document.getElementById('newItemImage').value = item.imageUrl || '';
  document.getElementById('newItemDesc').value = item.desc || '';
  document.getElementById('itemFormError').textContent = '';
  document.getElementById('itemModalTitle').textContent = 'Edit item';
  document.getElementById('itemSaveButton').textContent = 'Save changes';
  const modal = document.getElementById('itemModal'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
}
function closeAddItem(){ editingProductId = null; const modal = document.getElementById('itemModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
async function saveNewItem(){
  const name = clean(document.getElementById('newItemName').value);
  const price = Number(document.getElementById('newItemPrice').value);
  const errorBox = document.getElementById('itemFormError'); errorBox.textContent = '';
  if (name.length < 2 || !Number.isFinite(price) || price < 0){ errorBox.textContent = 'Add an item name and a valid price.'; return; }
  const cat = document.getElementById('newItemCategory').value;
  const data = {
    name,price,cat,type:cat === 'Clothing' ? 'clothing' : cat === 'Everyday Items' ? 'everyday' : 'crochet',
    status:document.getElementById('newItemStatus').value,
    fulfill:document.getElementById('newItemFulfill').value,
    imageUrl:clean(document.getElementById('newItemImage').value),
    desc:clean(document.getElementById('newItemDesc').value),
    updatedAt:cloud.serverTimestamp()
  };
  const wasEditing = Boolean(editingProductId);
  try {
    if (wasEditing) await cloud.db.collection('products').doc(editingProductId).update(data);
    else await cloud.db.collection('products').add({...data,createdAt:cloud.serverTimestamp()});
    closeAddItem(); toast(`${name} ${wasEditing ? 'updated' : 'added'}`); resetItemForm();
  } catch (error){ console.error(error); errorBox.textContent = 'The item could not be saved.'; }
}
async function deleteProduct(id){
  if (!adminUser || !confirm('Delete this item from the storefront?')) return;
  try { await cloud.db.collection('products').doc(String(id)).delete(); toast('Item deleted'); }
  catch (error){ console.error(error); toast('Item could not be deleted'); }
}
async function seedSampleProducts(){
  if (!adminUser || cloudProductsLoaded) return;
  const batch = cloud.db.batch();
  sampleItems.forEach((item,i) => {
    const ref = cloud.db.collection('products').doc(`starter-${i+1}`);
    const {id,...data} = item;
    batch.set(ref,{...data,createdAt:cloud.serverTimestamp(),updatedAt:cloud.serverTimestamp()});
  });
  try { await batch.commit(); toast('Starter products added to Firebase'); }
  catch (error){ console.error(error); toast('Starter products could not be added'); }
}
function renderAdminInventory(){
  const box = document.getElementById('adminInventory');
  if (!box) return;
  document.getElementById('inventoryModeNote').innerHTML = cloudProductsLoaded ? 'Live Firebase inventory' : `Showing preview items. <button class="inlineAction" onclick="seedSampleProducts()">Add starter items to Firebase</button>`;
  box.innerHTML = items.map(x => `<div class="adminItemRow"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.status)} · ${money(x.price)} · ${escapeHtml(x.cat)}</small></div>${cloudProductsLoaded ? `<div style="display:flex;gap:10px"><button class="linkbtn" onclick="openEditItem('${safeId(x.id)}')">Edit</button><button class="textbtn" onclick="deleteProduct('${safeId(x.id)}')">Delete</button></div>` : ''}</div>`).join('');
}
function renderNeedsAttention(){
  const box = document.getElementById('needsAttention');
  if (!box) return;
  const pending = claimRows.filter(c => c.status === 'Pending');
  if (!pending.length){ box.innerHTML = '<div class="empty">No pending claims.</div>'; return; }
  box.innerHTML = pending.slice(0,3).map(c => `<div class="listrow"><span class="dot"></span><div class="grow"><strong>${escapeHtml(c.claimNumber || 'Claim')} · ${escapeHtml(c.name || '')}</strong><small>${escapeHtml(c.method || '')} · ${Array.isArray(c.items) ? c.items.length : 0} item(s) · ${money(c.subtotal)}</small></div><button class="smallbtn" style="width:auto;padding:0 12px" onclick="scrollToRecentClaims()">Open</button></div>`).join('');
}
function scrollToRecentClaims(){ document.getElementById('adminClaims')?.scrollIntoView({behavior:'smooth',block:'center'}); }
function renderAdminClaims(){
  const box = document.getElementById('adminClaims');
  if (!box) return;
  renderNeedsAttention();
  if (!claimRows.length){ box.innerHTML = '<div class="empty">No claims yet.</div>'; return; }
  box.innerHTML = claimRows.slice(0,12).map(c => `<div class="adminItemRow"><div><strong>${escapeHtml(c.claimNumber || 'Claim')} · ${escapeHtml(c.name || '')}</strong><small>${escapeHtml(c.email || '')} · ${escapeHtml(c.method || '')} · ${money(c.subtotal)}</small></div><select class="miniSelect" onchange="updateClaimStatus('${safeId(c.id)}',this.value)"><option ${c.status==='Pending'?'selected':''}>Pending</option><option ${c.status==='Contacted'?'selected':''}>Contacted</option><option ${c.status==='Completed'?'selected':''}>Completed</option><option ${c.status==='Cancelled'?'selected':''}>Cancelled</option></select></div>`).join('');
}
async function updateClaimStatus(id,status){ if (!adminUser) return; try { await cloud.db.collection('claims').doc(id).update({status,updatedAt:cloud.serverTimestamp()}); toast('Claim updated'); } catch(error){ console.error(error); toast('Claim could not be updated'); } }
function updateAdminStats(){
  const stats = document.querySelectorAll('#admin .stat strong');
  if (stats[0]) stats[0].textContent = items.filter(x => x.status === 'Available').length;
  if (stats[1]) stats[1].textContent = claimRows.filter(x => x.status === 'Pending').length;
  if (stats[2]) stats[2].textContent = '0';
  if (stats[3]) stats[3].textContent = '—';
}
function startClaimsListener(){
  if (claimsUnsubscribe) claimsUnsubscribe();
  claimsUnsubscribe = cloud.db.collection('claims').onSnapshot(snapshot => {
    claimRows = snapshot.docs.map(doc => ({id:doc.id,...doc.data()})).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderAdminClaims(); renderNeedsAttention(); updateAdminStats();
  }, error => console.error('Claims listener failed',error));
}

function initCloud(){
  ensureCloudUi();
  if (!cloud.ready){ document.body.classList.add('cloudUnavailable'); renderProducts(); return; }
  cloud.db.collection('products').onSnapshot(snapshot => {
    cloudProductsLoaded = !snapshot.empty;
    if (snapshot.empty) items = [...sampleItems];
    else items = snapshot.docs.map(doc => ({id:doc.id,...doc.data()})).filter(x => x.status !== 'Sold');
    current = items[0]; renderProducts(); updateAdminStats();
  }, error => { console.error('Products listener failed',error); items = [...sampleItems]; renderProducts(); });
  cloud.auth.onAuthStateChanged(user => {
    if (user && cloud.isAdminEmail(user.email)){
      adminUser = user; setAdminLocked(false); document.getElementById('adminGate')?.classList.remove('show');
      const greeting = document.querySelector('#admin .adminHeader h1'); if (greeting) greeting.textContent = `Welcome, ${user.email.startsWith('k.') ? 'Katie' : 'Amanda'}`;
      startClaimsListener(); renderAdminInventory();
    } else {
      adminUser = null; setAdminLocked(true); if (claimsUnsubscribe){ claimsUnsubscribe(); claimsUnsubscribe = null; }
    }
  });
}

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>t.classList.remove('show'),2600); }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click',() => showView(b.dataset.go)));
initCloud(); renderProducts(); updateCount();
