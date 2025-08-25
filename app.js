// Organic Grocery Orders - Vanilla JS
// Storage keys
const KEY_PRODUCTS = 'og_products_v1';
const KEY_ORDERS = 'og_orders_v1';
const KEY_SETTINGS = 'og_settings_v1';

// Basic elements
const el = (id) => document.getElementById(id);
const itemsDiv = el('items');
const ordersDiv = el('orders');
const searchInput = el('search');
const subtotalEl = el('subtotal');
const grandTotalEl = el('grandTotal');
const deliveryFeeEl = el('deliveryFee');
const discountEl = el('discount');
const productCountEl = el('productCount');
const deliverySlotSel = el('deliverySlot');

// Admin elements
const adminPanel = el('adminPanel');
const adminLogin = el('adminLogin');
const adminStatus = el('adminStatus');
const adminPassInput = el('adminPass');
const adminBtn = el('adminBtn');
const csvFileInput = el('csvFile');
const exportOrdersBtn = el('exportOrders');
const clearOrdersBtn = el('clearOrders');
const deliveryFeeInput = el('deliveryFeeInput');

// State
let products = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
let orders = JSON.parse(localStorage.getItem(KEY_ORDERS) || '[]');
let settings = JSON.parse(localStorage.getItem(KEY_SETTINGS) || '{"deliveryFee":0,"adminPass":"organic@123"}');
let cart = {}; // {productIndex: qty}

// Init
init();

function init(){
  // Delivery slots: upcoming Tuesdays & Fridays for next 3 weeks
  fillDeliverySlots();
  if(products.length === 0){
    // Seed example products
    products = [
      {name:"Tomato", unit:"kg", price: 40},
      {name:"Banana (Robusta)", unit:"dozen", price: 55},
      {name:"Cold-pressed Groundnut Oil", unit:"litre", price: 280},
      {name:"Tur Dal (Organic)", unit:"kg", price: 190},
      {name:"Country Eggs", unit:"6 pcs", price: 70},
    ];
    saveProducts();
  }
  productCountEl.textContent = products.length;
  renderProducts();
  renderOrders();
  deliveryFeeInput.value = settings.deliveryFee || 0;
  deliveryFeeEl.textContent = (settings.deliveryFee || 0).toFixed(2);
  discountEl.addEventListener('input', recalcTotals);
  searchInput.addEventListener('input', renderProducts);
  el('saveOrder').addEventListener('click', saveOrder);
  // Admin
  adminBtn.addEventListener('click', unlockAdmin);
  csvFileInput.addEventListener('change', handleCSV);
  exportOrdersBtn.addEventListener('click', exportOrdersCSV);
  clearOrdersBtn.addEventListener('click', clearOrders);
  deliveryFeeInput.addEventListener('input', () => {
    settings.deliveryFee = Number(deliveryFeeInput.value || 0);
    saveSettings();
    deliveryFeeEl.textContent = settings.deliveryFee.toFixed(2);
    recalcTotals();
  });
}

function fillDeliverySlots(){
  const slots = upcomingTueFri(12); // next ~6 weeks
  deliverySlotSel.innerHTML = '';
  slots.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.toISOString();
    opt.textContent = d.toDateString();
    deliverySlotSel.appendChild(opt);
  });
}

function upcomingTueFri(count){
  const res = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  let d = new Date(today);
  while(res.length < count){
    d.setDate(d.getDate()+1);
    const day = d.getDay(); // 0 Sun ... 6 Sat
    if(day === 2 || day === 5){ // Tue or Fri
      res.push(new Date(d));
    }
  }
  return res;
}

function renderProducts(){
  const q = (searchInput.value || '').toLowerCase();
  itemsDiv.innerHTML = '';
  products
    .map((p, idx) => ({...p, idx}))
    .filter(p => p.name.toLowerCase().includes(q))
    .forEach(p => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '6px';
      row.innerHTML = `
        <div style="flex:2;">${p.name}</div>
        <div style="flex:1;"><span class="badge">${p.unit}</span></div>
        <div style="flex:1;">₹ ${Number(p.price).toFixed(2)}</div>
        <div style="flex:1;">
          <input type="number" min="0" step="0.5" value="${cart[p.idx] || 0}" data-idx="${p.idx}" class="qty" />
        </div>
        <div style="flex:1;" class="right">₹ <span id="amt-${p.idx}">0.00</span></div>
      `;
      itemsDiv.appendChild(row);
    });
  // attach listeners
  itemsDiv.querySelectorAll('.qty').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const qty = Number(e.target.value || 0);
      cart[idx] = qty;
      const amt = qty * Number(products[idx].price);
      const amtEl = document.getElementById(`amt-${idx}`);
      if(amtEl) amtEl.textContent = amt.toFixed(2);
      recalcTotals();
    });
  });
  recalcTotals();
}

function recalcTotals(){
  let subtotal = 0;
  Object.keys(cart).forEach(k => {
    const idx = Number(k);
    const qty = Number(cart[idx] || 0);
    subtotal += qty * Number(products[idx].price);
  });
  subtotalEl.textContent = subtotal.toFixed(2);
  const delivery = Number(settings.deliveryFee || 0);
  deliveryFeeEl.textContent = delivery.toFixed(2);
  const discount = Number(discountEl.value || 0);
  const total = Math.max(0, subtotal + delivery - discount);
  grandTotalEl.textContent = total.toFixed(2);
}

function saveOrder(){
  const name = el('custName').value.trim();
  const phone = el('custPhone').value.trim();
  const address = el('custAddress').value.trim();
  const notes = el('orderNotes').value.trim();
  const slotISO = deliverySlotSel.value;
  if(!name || !phone || !address || !slotISO){
    alert('Please fill customer details and delivery slot.');
    return;
  }
  const items = Object.keys(cart).filter(k => Number(cart[k])>0).map(k => {
    const idx = Number(k);
    return { name: products[idx].name, unit: products[idx].unit, price: Number(products[idx].price), qty: Number(cart[idx]), amount: Number(cart[idx]) * Number(products[idx].price) };
  });
  if(items.length === 0){
    alert('Add at least one item.');
    return;
  }
  const order = {
    id: 'ORD' + Date.now(),
    name, phone, address, notes,
    slotISO,
    items,
    subtotal: Number(subtotalEl.textContent),
    deliveryFee: Number(settings.deliveryFee||0),
    discount: Number(discountEl.value||0),
    total: Number(grandTotalEl.textContent),
    status: 'Pending',
    delivered: false,
    createdAt: new Date().toISOString(),
    deliveredAt: null
  };
  orders.unshift(order);
  saveOrders();
  renderOrders();
  // Offer bill PDF + WhatsApp share
  downloadBillPDF(order);
  shareWhatsApp(order);
  // Clear cart
  cart = {};
  document.querySelectorAll('.qty').forEach(q => q.value = 0);
  recalcTotals();
  alert('Order saved.');
}

function renderOrders(){
  ordersDiv.innerHTML = '';
  if(orders.length === 0){
    ordersDiv.innerHTML = '<div class="muted">No orders yet.</div>';
    return;
  }
  orders.forEach(order => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '6px';
    const statusBadge = order.delivered ? '<span class="badge">✅ Delivered</span>' : '<span class="badge">⏳ Pending</span>';
    row.innerHTML = `
      <div style="flex:2;">
        <div><strong>${order.name}</strong> <span class="muted small">(${order.phone})</span></div>
        <div class="small muted">${order.address}</div>
        <div class="small">#${order.id}</div>
      </div>
      <div style="flex:1;" class="small">${new Date(order.slotISO).toDateString()}</div>
      <div style="flex:1;">₹ ${order.total.toFixed(2)}</div>
      <div style="flex:2;">
        <div class="flex">
          ${statusBadge}
          <label class="pill"><input type="checkbox" ${order.delivered ? 'checked':''} data-id="${order.id}" class="deliveredToggle" /> Mark delivered</label>
          <button class="btn alt small" data-id="${order.id}" data-act="bill">Bill PDF</button>
          <button class="btn small" data-id="${order.id}" data-act="share">Share WhatsApp</button>
          <button class="btn warn small" data-id="${order.id}" data-act="edit">Edit</button>
          <button class="btn danger small" data-id="${order.id}" data-act="delete">Delete</button>
        </div>
      </div>
    `;
    ordersDiv.appendChild(row);
  });
  // attach listeners
  ordersDiv.querySelectorAll('.deliveredToggle').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const ord = orders.find(o => o.id === id);
      if(!ord) return;
      ord.delivered = e.target.checked;
      ord.status = ord.delivered ? 'Delivered' : 'Pending';
      ord.deliveredAt = ord.delivered ? new Date().toISOString() : null;
      saveOrders();
      renderOrders();
    });
  });
  ordersDiv.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const act = e.target.dataset.act;
      const ord = orders.find(o => o.id === id);
      if(!ord) return;
      if(act === 'bill') downloadBillPDF(ord);
      if(act === 'share') shareWhatsApp(ord);
      if(act === 'delete') { 
        if(confirm('Delete this order?')){
          orders = orders.filter(o => o.id !== id);
          saveOrders(); renderOrders();
        }
      }
      if(act === 'edit'){
        // Load to form for quick edit
        el('custName').value = ord.name;
        el('custPhone').value = ord.phone;
        el('custAddress').value = ord.address;
        el('orderNotes').value = ord.notes || '';
        deliverySlotSel.value = ord.slotISO;
        cart = {};
        products.forEach((p, idx) => {
          const found = ord.items.find(i => i.name === p.name);
          cart[idx] = found ? found.qty : 0;
        });
        renderProducts();
        discountEl.value = ord.discount || 0;
        recalcTotals();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function saveProducts(){ localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products)); productCountEl.textContent = products.length; }
function saveOrders(){ localStorage.setItem(KEY_ORDERS, JSON.stringify(orders)); }
function saveSettings(){ localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); }

function unlockAdmin(){
  const pass = adminPassInput.value;
  if(pass && pass === settings.adminPass){
    adminPanel.classList.remove('hide');
    adminLogin.classList.add('hide');
    adminStatus.textContent = 'Admin: On';
  }else{
    alert('Wrong passcode.');
  }
}

// CSV import
function handleCSV(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const header = rows.shift().split(',').map(s => s.trim().toLowerCase());
    const idxName = header.indexOf('name');
    const idxUnit = header.indexOf('unit');
    const idxPrice = header.indexOf('price');
    if(idxName === -1 || idxUnit === -1 || idxPrice === -1){
      alert('CSV must have columns: name, unit, price');
      return;
    }
    const imported = rows.map(r => {
      const cols = r.split(',').map(s => s.trim());
      return { name: cols[idxName], unit: cols[idxUnit], price: Number(cols[idxPrice]) };
    }).filter(p => p.name && p.unit && !Number.isNaN(p.price));
    if(imported.length === 0){ alert('No valid rows.'); return; }
    products = imported;
    saveProducts();
    renderProducts();
    alert('Products updated.');
  };
  reader.readAsText(file);
}

// Export orders CSV
function exportOrdersCSV(){
  if(orders.length === 0){ alert('No orders to export'); return; }
  const header = ['id','name','phone','address','slotDate','subtotal','deliveryFee','discount','total','status','deliveredAt','itemsJSON'];
  const lines = [header.join(',')];
  orders.forEach(o => {
    const line = [
      o.id, csvEscape(o.name), o.phone, csvEscape(o.address),
      new Date(o.slotISO).toISOString().slice(0,10),
      o.subtotal.toFixed(2), o.deliveryFee.toFixed(2), (o.discount||0).toFixed(2), o.total.toFixed(2),
      o.status, o.deliveredAt ? o.deliveredAt : '',
      csvEscape(JSON.stringify(o.items))
    ].join(',');
    lines.push(line);
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'orders-export.csv'; a.click();
  URL.revokeObjectURL(url);
}
function csvEscape(s){
  if(typeof s !== 'string') return s;
  if(s.includes(',') || s.includes('"') || s.includes('\n')){
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}
function clearOrders(){
  if(confirm('Clear ALL orders? This cannot be undone.')){
    orders = []; saveOrders(); renderOrders();
  }
}

// Generate PDF invoice
function downloadBillPDF(order){
  // Build simple HTML and render via html2canvas -> jsPDF
  const el = document.createElement('div');
  el.style.padding = '16px';
  el.style.width = '600px';
  el.innerHTML = `
    <div style="font-family:Arial;">
      <h2 style="margin:0 0 6px 0;">Invoice - ${order.id}</h2>
      <div style="font-size:12px;color:#555">Organic Grocery • Delivery: ${new Date(order.slotISO).toDateString()}</div>
      <hr/>
      <div><strong>${order.name}</strong> (${order.phone})</div>
      <div style="white-space:pre-wrap">${order.address}</div>
      <div style="margin-top:6px;font-size:12px;">Notes: ${order.notes || '-'}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">
        <thead><tr><th align="left">Item</th><th align="left">Unit</th><th align="right">Price</th><th align="right">Qty</th><th align="right">Amount</th></tr></thead>
        <tbody>
          ${order.items.map(i => `<tr>
            <td>${i.name}</td><td>${i.unit}</td>
            <td align="right">₹ ${i.price.toFixed(2)}</td>
            <td align="right">${i.qty}</td>
            <td align="right">₹ ${(i.amount).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <hr/>
      <div style="text-align:right">
        <div>Subtotal: ₹ ${order.subtotal.toFixed(2)}</div>
        <div>Delivery: ₹ ${order.deliveryFee.toFixed(2)}</div>
        <div>Discount: ₹ ${(order.discount||0).toFixed(2)}</div>
        <div style="font-size:18px;font-weight:bold">Grand Total: ₹ ${order.total.toFixed(2)}</div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:#555">Thank you for supporting organic farmers. No delivery charge. Tue & Fri deliveries.</div>
    </div>
  `;
  document.body.appendChild(el);
  html2canvas(el).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({orientation:'p', unit:'pt', format:'a4'});
    const pageWidth = pdf.internal.pageSize.getWidth();
    const scale = pageWidth / canvas.width;
    const imgHeight = canvas.height * scale;
    pdf.addImage(imgData, 'PNG', 0, 20, pageWidth, imgHeight);
    pdf.save(`${order.id}.pdf`);
    document.body.removeChild(el);
  });
}

// WhatsApp share (text)
function shareWhatsApp(order){
  const lines = [];
  lines.push(`Invoice ${order.id}`);
  lines.push(`Name: ${order.name}`);
  lines.push(`Total: ₹ ${order.total.toFixed(2)}`);
  lines.push(`Delivery: ${new Date(order.slotISO).toDateString()}`);
  lines.push('Items:');
  order.items.forEach(i => lines.push(`- ${i.name} x ${i.qty} = ₹ ${(i.amount).toFixed(2)}`));
  const text = encodeURIComponent(lines.join('\n'));
  const url = `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

// External libs loaders
(function injectLibs(){
  const s1 = document.createElement('script');
  s1.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  document.body.appendChild(s1);
  const s2 = document.createElement('script');
  s2.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  document.body.appendChild(s2);
})();
