(function(){
  const DEFAULT_SERVICES = [
    { id:'device-provisioning-service', name:'device-provisioning-service' },
    { id:'device-registration-service', name:'device-registration-service' },
    { id:'iotsense-object-storage-service', name:'iotsense-object-storage-service' },
    { id:'port-registry', name:'port-registry' },
    { id:'pipeline-service', name:'pipeline service' },
    { id:'certificate-service', name:'certificate service' },
    { id:'in-node', name:'IN node' },
    { id:'mn-node', name:'MN node' },
    { id:'k8-service', name:'k8-service' },
    { id:'iotsense-cloud-gateway-service', name:'iotsense-cloud-gateway-service' },
    { id:'iotsense-database-service', name:'iotsense-database-service' },
    { id:'iotsense-messaging-service', name:'iotsense-messaging-service' },
    { id:'iotsense-object-storage-service-db', name:'iotsense-object-storage-service (database)' },
    { id:'frontend-ui', name:'Frontend UI' },
  ];
  const DEFAULT_SERVICE_IDS = new Set(DEFAULT_SERVICES.map(s=>s.id));
  let SERVICES = [...DEFAULT_SERVICES];

  function slugify(str){ return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, ''); }

  const SEV_KEYS = ['critical','high','medium','low','negligible'];
  const SEV_CLASS = { critical:'sev-critical', high:'sev-high', medium:'sev-medium', low:'sev-low', negligible:'sev-neutral' };
  const RATING_CLASS = { A:'rating-a', B:'rating-b', C:'rating-c', D:'rating-d', E:'rating-e' };
  const RATING_RANK = { A:0, B:1, C:2, D:3, E:4 };

  // Chart instances
  let vaptChartInstance = null;
  let topVaptChartInstance = null;
  let sonarMetricsChartInstance = null;

  // Set Chart.js global defaults for dark theme
  Chart.defaults.color = '#8295A6';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  let sprints = [];
  let activeSprint = null;
  let currentEditService = null;
  let detailServiceId = null;

  const $ = (id) => document.getElementById(id);
  const toast = $('toast');
  function showToast(msg){ if(!toast) return; toast.textContent = msg; toast.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(()=>toast.classList.remove('show'), 2400); }
  function escapeHtml(str){ const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }
  function openModal(id){ const el = $(id); if(el) el.classList.add('open'); }
  function closeModal(id){ const el = $(id); if(el) el.classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach(btn=>{ btn.addEventListener('click', ()=>closeModal(btn.dataset.close)); });
  document.querySelectorAll('.modal-overlay').forEach(ov=>{ ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.classList.remove('open'); }); });

  const FIREBASE_CONFIG = {
      apiKey: "",
      authDomain: "",
      projectId: "vapt-sonar",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      measurementId: ""
  };

  let firestoreDb = null;
  const FIRESTORE_COLLECTION = 'vaptsonar_data';

  try {
    if (FIREBASE_CONFIG.apiKey && typeof firebase !== 'undefined') {
      firebase.initializeApp(FIREBASE_CONFIG);
      firestoreDb = firebase.firestore();
    }
  } catch(e) { console.warn('Firebase init fallback to localStorage', e); }
  const hasFirestore = !!firestoreDb;

  async function storageGet(key){
    try{
      const localRaw = window.localStorage.getItem(key);
      const localData = localRaw ? JSON.parse(localRaw) : null;
      if(hasFirestore){
        const fetchPromise = firestoreDb.collection(FIRESTORE_COLLECTION).doc(key).get().then(doc => {
          if(doc.exists) window.localStorage.setItem(key, JSON.stringify(doc.data().value));
        });
        if (localData) return localData; 
        await fetchPromise; 
        const freshRaw = window.localStorage.getItem(key);
        return freshRaw ? JSON.parse(freshRaw) : null;
      }
      return localData;
    }catch(e){ return null; }
  }

  async function storageSet(key, value){
    try{
      window.localStorage.setItem(key, JSON.stringify(value)); 
      if(hasFirestore) firestoreDb.collection(FIRESTORE_COLLECTION).doc(key).set({ value }); 
      return true;
    }catch(e){ return false; }
  }

  async function storageDelete(key){
    try{
      window.localStorage.removeItem(key);
      if(hasFirestore) firestoreDb.collection(FIRESTORE_COLLECTION).doc(key).delete();
      return true;
    }catch(e){ return false; }
  }

  function sprintDataKey(sprint){ return `sprintdata:${sprint}`; }
  let currentSprintData = null;
  function emptySprintData(){ return { vapt:{}, sonar:{}, branches:{} }; }

  async function loadCurrentSprintData(){
    if(!activeSprint){ currentSprintData = null; return; }
    const data = await storageGet(sprintDataKey(activeSprint));
    currentSprintData = data || emptySprintData();
    if(!currentSprintData.vapt) currentSprintData.vapt = {};
    if(!currentSprintData.sonar) currentSprintData.sonar = {};
    if(!currentSprintData.branches) currentSprintData.branches = {};
  }

  async function persistCurrentSprintData(){
    if(!activeSprint || !currentSprintData) return false;
    return storageSet(sprintDataKey(activeSprint), currentSprintData);
  }

  function formatRelativeTime(ts){
    if(!ts) return '—';
    const diff = Date.now() - ts; const min = Math.floor(diff/60000);
    if(min < 1) return 'just now'; if(min < 60) return `${min} min ago`;
    const hr = Math.floor(min/60); if(hr < 24) return `${hr} hr ago`;
    return `${Math.floor(hr/24)} d ago`;
  }

  // --- Smooth Scrolling for Navigation ---
  if($('sidebarToggle')) $('sidebarToggle').addEventListener('click', ()=>{ $('sidebar').classList.toggle('is-open'); });
  
  document.querySelectorAll('.nav-item a').forEach(link=>{
    link.addEventListener('click', (e)=>{
      e.preventDefault();
      const item = link.parentElement;
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
      item.classList.add('active');
      if($('sidebar')) $('sidebar').classList.remove('is-open');

      const targetId = item.dataset.target;
      const scrollContainer = $('dashboard');
      
      if(targetId === 'dashboard') {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const targetEl = $(targetId);
        if(targetEl) {
           const topPos = targetEl.offsetTop - scrollContainer.offsetTop - 20;
           scrollContainer.scrollTo({ top: topPos, behavior: 'smooth' });
        }
      }
    });
  });

  async function loadCustomServices(){
    const custom = await storageGet('customServices') || [];
    SERVICES = [...DEFAULT_SERVICES, ...custom];
  }
  
  function renderServicesList(){
    const list = $('servicesList'); if(!list) return;
    list.innerHTML = SERVICES.map(svc=>{
      const isDefault = DEFAULT_SERVICE_IDS.has(svc.id);
      return `<div class="service-row">
        <span class="service-row-name"><i class="fa-solid fa-cube"></i>${escapeHtml(svc.name)}</span>
        ${isDefault ? '<span class="badge-default">Default</span>' : `<button type="button" class="service-row-remove" data-remove-service="${svc.id}"><i class="fa-solid fa-trash"></i></button>`}
      </div>`;
    }).join('');
    if($('serviceCountLabel')) $('serviceCountLabel').textContent = SERVICES.length;

    list.querySelectorAll('[data-remove-service]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.dataset.removeService; const svc = SERVICES.find(s=>s.id===id);
        if(!window.confirm(`Remove service "${svc.name}"?`)) return;
        SERVICES = SERVICES.filter(s=>s.id !== id);
        await storageSet('customServices', SERVICES.filter(s=>!DEFAULT_SERVICE_IDS.has(s.id)));
        renderServicesList(); await renderAll(); showToast(`Removed ${svc.name}`);
      });
    });
  }

  if($('manageServicesBtn')) $('manageServicesBtn').addEventListener('click', ()=>{ renderServicesList(); openModal('servicesModal'); });
  if($('addServiceBtn')){
    $('addServiceBtn').addEventListener('click', async ()=>{
      const name = $('newServiceName') ? $('newServiceName').value.trim() : '';
      const id = slugify(name);
      if(!id || SERVICES.some(s=>s.id === id)){ showToast('Enter a valid unique service name'); return; }
      const link = $('newServiceLink') ? $('newServiceLink').value.trim() : '';
      SERVICES.push({ id, name, link });
      await storageSet('customServices', SERVICES.filter(s=>!DEFAULT_SERVICE_IDS.has(s.id)));
      if($('newServiceName')) $('newServiceName').value = '';
      if($('newServiceLink')) $('newServiceLink').value = '';
      renderServicesList(); await renderAll(); showToast(`Added service "${name}"`);
    });
  }

  if($('searchInput')){
    $('searchInput').addEventListener('input', (e)=>{
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#vaptBody tr, #sonarBody tr').forEach(tr=>{
        const nameCell = tr.querySelector('.cell-service');
        if(nameCell) tr.classList.toggle('row-hidden', !!q && !nameCell.textContent.toLowerCase().includes(q));
      });
    });
  }

  // Export/Import
  if($('exportBtn')){
    $('exportBtn').addEventListener('click', async ()=>{
      if(!activeSprint || !currentSprintData){ showToast('No sprint selected'); return; }
      const blob = new Blob([JSON.stringify({ sprint: activeSprint, ...currentSprintData }, null, 2)], { type:'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${activeSprint}-report.json`; a.click();
    });
  }
  if($('importBtn')) $('importBtn').addEventListener('click', ()=> $('importFileInput').click());
  if($('importFileInput')){
    $('importFileInput').addEventListener('change', async (e)=>{
      const file = e.target.files[0]; e.target.value = '';
      if(!file) return;
      try{
        const parsed = JSON.parse(await file.text()); const sprintName = parsed.sprint;
        if(!sprintName) throw new Error();
        if(sprints.includes(sprintName) && !window.confirm(`Overwrite sprint "${sprintName}"?`)) return;
        await storageSet(sprintDataKey(sprintName), { vapt: parsed.vapt||{}, sonar: parsed.sonar||{}, branches: parsed.branches||{} });
        if(!sprints.includes(sprintName)){ sprints.push(sprintName); await storageSet('sprints', sprints); }
        activeSprint = sprintName; populateSprintSelect(); await renderAll(); showToast(`Imported sprint "${sprintName}"`);
      }catch(err){ showToast('Invalid JSON file'); }
    });
  }

  if($('detailExportServiceBtn')){
    $('detailExportServiceBtn').addEventListener('click', () => {
      if(!detailServiceId || !currentSprintData) return;
      const data = { serviceId: detailServiceId, vapt: currentSprintData.vapt[detailServiceId]||null, sonar: currentSprintData.sonar[detailServiceId]||null, branch: currentSprintData.branches[detailServiceId]||null };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${detailServiceId}-service-data.json`; a.click();
    });
  }
  if($('detailImportServiceBtn')) $('detailImportServiceBtn').addEventListener('click', () => $('serviceImportFileInput').click());
  if($('serviceImportFileInput')){
    $('serviceImportFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; e.target.value = ''; 
      if(!file) return;
      try {
          const parsed = JSON.parse(await file.text());
          if(parsed.vapt) currentSprintData.vapt[detailServiceId] = parsed.vapt;
          if(parsed.sonar) currentSprintData.sonar[detailServiceId] = parsed.sonar;
          if(parsed.branch) currentSprintData.branches[detailServiceId] = parsed.branch;
          await persistCurrentSprintData(); await renderAll(); openServiceDetailModal(detailServiceId); showToast(`Imported data for ${detailServiceId}`);
      } catch(err) { showToast('Invalid service JSON'); }
    });
  }

  function populateSprintSelect(){
    const list = $('sprintDropdownList'); if(!list) return;
    list.innerHTML = '';
    if(!sprints.length){
      if($('sprintSelectLabel')) $('sprintSelectLabel').textContent = 'No sprints yet';
      if($('sprintSelectBtn')) $('sprintSelectBtn').disabled = true;
      list.innerHTML = `<div class="sprint-dropdown-empty">Create a sprint to begin</div>`;
    }else{
      if($('sprintSelectBtn')) $('sprintSelectBtn').disabled = false;
      if($('sprintSelectLabel')) $('sprintSelectLabel').textContent = activeSprint;
      sprints.forEach(s=>{
        const item = document.createElement('div');
        item.className = 'sprint-dropdown-item' + (s === activeSprint ? ' active' : '');
        item.textContent = s;
        item.addEventListener('click', async ()=>{
          activeSprint = s; $('sprintDropdownList').classList.remove('open'); populateSprintSelect(); await renderAll();
        });
        list.appendChild(item);
      });
    }
    if($('renameSprintBtn')) $('renameSprintBtn').disabled = !activeSprint;
    if($('deleteSprintBtn')) $('deleteSprintBtn').disabled = !activeSprint;
    populateComparisonDropdowns();
  }

  if($('sprintSelectBtn')) $('sprintSelectBtn').addEventListener('click', (e)=>{ e.stopPropagation(); $('sprintDropdownList').classList.toggle('open'); });
  document.addEventListener('click', (e)=>{ if($('sprintSelectorWrap') && !$('sprintSelectorWrap').contains(e.target) && $('sprintDropdownList')) $('sprintDropdownList').classList.remove('open'); });

  let sprintModalMode = 'create';
  function openSprintModal(mode){
    sprintModalMode = mode || 'create';
    if($('sprintNameInput')) $('sprintNameInput').value = sprintModalMode === 'rename' ? activeSprint : '';
    if($('sprintModalTitle')) $('sprintModalTitle').textContent = sprintModalMode === 'rename' ? 'Rename sprint' : 'Create new sprint';
    if($('createSprintBtn')) $('createSprintBtn').textContent = sprintModalMode === 'rename' ? 'Rename' : 'Create';
    openModal('sprintModal');
  }

  if($('newSprintBtn')) $('newSprintBtn').addEventListener('click', ()=>openSprintModal('create'));
  if($('emptyNewSprintBtn')) $('emptyNewSprintBtn').addEventListener('click', ()=>openSprintModal('create'));
  if($('renameSprintBtn')) $('renameSprintBtn').addEventListener('click', ()=> activeSprint && openSprintModal('rename'));

  if($('createSprintBtn')){
    $('createSprintBtn').addEventListener('click', async ()=>{
      const name = $('sprintNameInput').value.trim();
      if(!name || (sprintModalMode === 'create' && sprints.includes(name))) return showToast('Enter a unique sprint name');
      if(sprintModalMode === 'rename'){
        const data = await storageGet(sprintDataKey(activeSprint));
        if(data){ await storageSet(sprintDataKey(name), data); await storageDelete(sprintDataKey(activeSprint)); }
        sprints[sprints.indexOf(activeSprint)] = name;
      } else { sprints.push(name); }
      activeSprint = name; await storageSet('sprints', sprints); closeModal('sprintModal'); populateSprintSelect(); await renderAll(); showToast(`Sprint "${name}" saved`);
    });
  }

  if($('deleteSprintBtn')){
    $('deleteSprintBtn').addEventListener('click', async ()=>{
      if(!activeSprint || !window.confirm(`Delete sprint "${activeSprint}"? This action cannot be undone.`)) return;
      await storageDelete(sprintDataKey(activeSprint));
      sprints = sprints.filter(s=> s !== activeSprint);
      activeSprint = sprints.length ? sprints[sprints.length-1] : null;
      await storageSet('sprints', sprints); populateSprintSelect(); await renderAll(); showToast('Sprint deleted');
    });
  }

  function initializeTableSorting() {
    document.querySelectorAll('th.sortable').forEach(headerCell => {
      const newCell = headerCell.cloneNode(true); headerCell.parentNode.replaceChild(newCell, headerCell);
      newCell.addEventListener('click', () => {
        const tableElement = newCell.closest('table'); const tbodyElement = tableElement.querySelector('tbody');
        const columnIndex = Array.from(newCell.parentNode.children).indexOf(newCell);
        const isAscending = newCell.classList.contains('asc');
        tableElement.querySelectorAll('th').forEach(th => th.classList.remove('asc', 'desc'));
        newCell.classList.add(isAscending ? 'desc' : 'asc');
        const rows = Array.from(tbodyElement.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const aValue = a.children[columnIndex].textContent.trim(); const bValue = b.children[columnIndex].textContent.trim();
          const aNum = parseFloat(aValue.replace(/[^0-9.-]+/g,"")); const bNum = parseFloat(bValue.replace(/[^0-9.-]+/g,""));
          if (!isNaN(aNum) && !isNaN(bNum) && aValue !== '—' && bValue !== '—') return isAscending ? aNum - bNum : bNum - aNum;
          return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        });
        tbodyElement.append(...rows);
      });
    });
  }

  async function renderAll(){
    if(!activeSprint){
      if($('emptyState')) $('emptyState').style.display = ''; if($('dataSections')) $('dataSections').style.display = 'none';
      if($('actionBarTitle')) $('actionBarTitle').textContent = 'No sprint selected';
      currentSprintData = null; return;
    }
    if($('emptyState')) $('emptyState').style.display = 'none'; if($('dataSections')) $('dataSections').style.display = '';
    if($('actionBarTitle')) $('actionBarTitle').textContent = `${activeSprint} Overview`;
    if($('vaptSprintLabel')) $('vaptSprintLabel').textContent = activeSprint;
    if($('sonarSprintLabel')) $('sonarSprintLabel').textContent = activeSprint;
    
    await loadCurrentSprintData();
    const vaptResult = renderVapt();
    const sonarResult = renderSonar();
    await computeKpisAndCharts(vaptResult, sonarResult);
    initializeTableSorting();
    generateComparison(); 
  }

  function renderVapt(){
    const tbody = $('vaptBody'); if(!tbody) return {critical:0,high:0,medium:0,low:0,negligible:0}; tbody.innerHTML = '';
    const totals = {critical:0,high:0,medium:0,low:0,negligible:0};
    for(const svc of SERVICES){
      const data = currentSprintData.vapt[svc.id]; const branch = currentSprintData.branches[svc.id];
      if(data) SEV_KEYS.forEach(k=> totals[k] += Number(data[k]||0));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-service"><i class="fa-solid fa-cube"></i>${escapeHtml(svc.name)}</td>
        <td><span class="branch-chip ${branch?'':'empty'}" data-edit-vapt="${svc.id}">${branch?escapeHtml(branch.name):'set branch'}</span></td>
        ${SEV_KEYS.map(k=>`<td>${data ? `<span class="sev-pill ${SEV_CLASS[k]}">${data[k]||0}</span>` : '—'}</td>`).join('')}
        <td><span class="status-chip ${data ? (data.critical>0?'status-open':data.high>0||data.medium>0?'status-progress':'status-resolved') : 'status-pending'}">${data ? (data.critical>0?'Open':data.high>0||data.medium>0?'In Progress':'Resolved') : 'Pending'}</span></td>
        <td>${data ? formatRelativeTime(data.updatedAt) : '—'}</td>
        <td class="cell-actions">
          <button class="table-icon-btn" data-view-vapt="${svc.id}" title="View Details"><i class="fa-regular fa-eye"></i></button>
          <button class="table-icon-btn" data-edit-vapt="${svc.id}" title="Edit VAPT"><i class="fa-solid fa-pen"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-edit-vapt]').forEach(el=>el.addEventListener('click', ()=>openVaptModal(el.dataset.editVapt)));
    tbody.querySelectorAll('[data-view-vapt]').forEach(el=>el.addEventListener('click', ()=>openServiceDetailModal(el.dataset.viewVapt)));
    return totals;
  }

  function renderSonar(){
    const tbody = $('sonarBody'); if(!tbody) return { avgCoverage:0, vulns:0, bugs:0, smells:0 }; tbody.innerHTML = '';
    let covSum = 0, covCount = 0, vulns = 0, bugs = 0, smells = 0;
    
    for(const svc of SERVICES){
      const data = currentSprintData.sonar[svc.id]; const branch = currentSprintData.branches[svc.id];
      if(data){
        covSum += Number(data.coverage||0); covCount++;
        vulns += Number(data.securityNum||0); bugs += Number(data.reliabilityNum||0); smells += Number(data.maintainabilityNum||0);
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-service"><i class="fa-solid fa-cube"></i>${escapeHtml(svc.name)}</td>
        <td><span class="branch-chip ${branch?'':'empty'}" data-edit-sonar="${svc.id}">${branch?escapeHtml(branch.name):'set branch'}</span></td>
        ${['security','reliability','maintainability'].map(k=>`<td>${data ? `<span class="rating-pill ${RATING_CLASS[data[k]]}">${data[k+'Num']?`${data[k+'Num']}(${data[k]})`:data[k]}</span>` : '—'}</td>`).join('')}
        <td>${data ? `<div class="mini-progress"><span style="width:${data.coverage||0}%"></span></div><small>${data.coverage||0}%</small>` : '—'}</td>
        <td>${data ? `${data.duplications||0}%` : '—'}</td>
        <td><span class="status-chip ${data ? (['D','E'].includes(data.security)?'status-open':'status-resolved') : 'status-pending'}">${data ? (['D','E'].includes(data.security)?'Failed':'Passed') : 'Pending'}</span></td>
        <td>${data ? formatRelativeTime(data.updatedAt) : '—'}</td>
        <td class="cell-actions">
          <button class="table-icon-btn" data-view-sonar="${svc.id}" title="View Details"><i class="fa-regular fa-eye"></i></button>
          <button class="table-icon-btn" data-edit-sonar="${svc.id}" title="Edit Sonar"><i class="fa-solid fa-pen"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-edit-sonar]').forEach(el=>el.addEventListener('click', ()=>openSonarModal(el.dataset.editSonar)));
    tbody.querySelectorAll('[data-view-sonar]').forEach(el=>el.addEventListener('click', ()=>openServiceDetailModal(el.dataset.viewSonar)));
    return { avgCoverage: covCount ? Math.round(covSum/covCount) : 0, vulns, bugs, smells };
  }

  async function computeKpisAndCharts(vapt, sonar){
    if($('totalServices')) $('totalServices').textContent = SERVICES.length;
    if($('criticalCount')) $('criticalCount').textContent = vapt.critical;
    if($('highCount')) $('highCount').textContent = vapt.high;
    if($('mediumCount')) $('mediumCount').textContent = vapt.medium;
    if($('lowCount')) $('lowCount').textContent = vapt.low;
    if($('coverageAvg')) $('coverageAvg').textContent = sonar.avgCoverage + '%';
    if($('coverageBar')) $('coverageBar').style.width = sonar.avgCoverage + '%';
    
    if($('sonarVulnCount')) $('sonarVulnCount').textContent = sonar.vulns;
    if($('sonarBugsCount')) $('sonarBugsCount').textContent = sonar.bugs;
    if($('sonarSmellsCount')) $('sonarSmellsCount').textContent = sonar.smells;

    const idx = sprints.indexOf(activeSprint);
    if(idx > 0){
      const prevData = await storageGet(sprintDataKey(sprints[idx-1])) || {};
      let pC=0, pH=0, pM=0, pL=0, pVulns=0, pBugs=0, pSmells=0;
      Object.values(prevData.vapt||{}).forEach(v=>{ pC+=Number(v.critical||0); pH+=Number(v.high||0); pM+=Number(v.medium||0); pL+=Number(v.low||0); });
      Object.values(prevData.sonar||{}).forEach(s=>{ pVulns+=Number(s.securityNum||0); pBugs+=Number(s.reliabilityNum||0); pSmells+=Number(s.maintainabilityNum||0); });
      
      renderTrendEl('criticalTrend', vapt.critical - pC, true);
      renderTrendEl('highTrend', vapt.high - pH, true);
      renderTrendEl('mediumTrend', vapt.medium - pM, true);
      renderTrendEl('lowTrend', vapt.low - pL, true);
      renderTrendEl('sonarVulnTrend', sonar.vulns - pVulns, true);
      renderTrendEl('sonarBugsTrend', sonar.bugs - pBugs, true);
      renderTrendEl('sonarSmellsTrend', sonar.smells - pSmells, true);
    }else{
      ['criticalTrend','highTrend','mediumTrend','lowTrend','sonarVulnTrend','sonarBugsTrend','sonarSmellsTrend'].forEach(id=> { 
        if($(id)) { $(id).className='kpi-trend trend-flat'; $(id).innerHTML='no prior sprint'; }
      });
    }
    
    renderChartjs(vapt);
  }

  function renderTrendEl(id, diff, isBadRising){
    const el = $(id); if(!el) return;
    if(diff === 0){ el.className = 'kpi-trend trend-flat'; el.innerHTML = `<i class="fa-solid fa-minus"></i> unchanged`; return; }
    const rose = diff > 0;
    el.className = `kpi-trend ${isBadRising === rose ? 'trend-up' : 'trend-down'}`;
    el.innerHTML = `<i class="fa-solid ${rose ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${Math.abs(diff)} vs prev`;
  }

  async function showTrendBreakdown(metric, type='vapt') {
    if (sprints.length < 2 || sprints.indexOf(activeSprint) === 0) return;
    const prevData = await storageGet(sprintDataKey(sprints[sprints.indexOf(activeSprint)-1])) || {};
    const list = $('trendBreakdownList'); if(!list) return;
    list.innerHTML = ''; let changes = false;

    const cTypeData = currentSprintData[type] || {};
    const pTypeData = prevData[type] || {};

    SERVICES.forEach(svc => {
      const c = cTypeData[svc.id] ? Number(cTypeData[svc.id][metric]||0) : 0;
      const p = pTypeData[svc.id] ? Number(pTypeData[svc.id][metric]||0) : 0;
      if (c - p !== 0) {
        changes = true;
        list.innerHTML += `<div class="service-row"><span>${svc.name}</span><span style="color:var(--${c-p>0?'critical':'success'})"><i class="fa-solid fa-arrow-${c-p>0?'up':'down'}"></i> ${Math.abs(c-p)} (Now: ${c})</span></div>`;
      }
    });
    if(!changes) list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">No changes vs previous sprint.</p>';
    
    let displayTitle = metric.replace('Num', '');
    displayTitle = displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1);
    if($('trendBreakdownTitle')) $('trendBreakdownTitle').textContent = `${displayTitle} Change Breakdown`;
    
    openModal('trendBreakdownModal');
  }

  document.querySelectorAll('.clickable-kpi').forEach(el => {
    el.style.cursor = 'pointer'; 
    el.title = "Click to view breakdown details"; 
    el.addEventListener('click', () => showTrendBreakdown(el.dataset.metric, el.dataset.type || 'vapt'));
  });

  // ===================== CHART.JS RENDERING LOGIC =====================
  function renderChartjs(totals) {
    if (typeof Chart === 'undefined') return;

    // 1. Doughnut Chart (VAPT Totals)
    const vaptCtx = $('vaptDoughnutChart');
    if (vaptCtx) {
      if (vaptChartInstance) vaptChartInstance.destroy();
      vaptChartInstance = new Chart(vaptCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Critical', 'High', 'Medium', 'Low'],
          datasets: [{
            data: [totals.critical, totals.high, totals.medium, totals.low],
            backgroundColor: ['#FF4D4F', '#FF9800', '#FFD54F', '#00E5FF'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { position: 'right', labels: { color: '#B1C2D4', padding: 15, usePointStyle: true, pointStyle: 'circle' } }
          }
        }
      });
    }

    // Prepare Data for Service-Level Charts
    const vaptServices = [];
    const sonarServices = [];

    for (const svc of SERVICES) {
      const vData = currentSprintData.vapt[svc.id];
      if (vData) {
        const score = (Number(vData.critical||0) * 10) + (Number(vData.high||0) * 5) + (Number(vData.medium||0) * 2) + Number(vData.low||0);
        vaptServices.push({ name: svc.name, critical: vData.critical||0, high: vData.high||0, medium: vData.medium||0, score: score });
      }

      const sData = currentSprintData.sonar[svc.id];
      if (sData) {
        const debt = Number(sData.securityNum||0) + Number(sData.reliabilityNum||0) + Number(sData.maintainabilityNum||0);
        sonarServices.push({ name: svc.name, vulns: sData.securityNum||0, bugs: sData.reliabilityNum||0, smells: sData.maintainabilityNum||0, debt: debt });
      }
    }

    // Sort to get Top 6 Offenders
    vaptServices.sort((a, b) => b.score - a.score);
    const topVapt = vaptServices.slice(0, 6);

    sonarServices.sort((a, b) => b.debt - a.debt);
    const topSonar = sonarServices.slice(0, 6);

    // 2. Bar Chart (Top VAPT Offenders)
    const topVaptCtx = $('topVaptServicesChart');
    if (topVaptCtx) {
      if (topVaptChartInstance) topVaptChartInstance.destroy();
      topVaptChartInstance = new Chart(topVaptCtx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: topVapt.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
          datasets: [
            { label: 'Critical', data: topVapt.map(s => s.critical), backgroundColor: '#FF4D4F' },
            { label: 'High', data: topVapt.map(s => s.high), backgroundColor: '#FF9800' },
            { label: 'Medium', data: topVapt.map(s => s.medium), backgroundColor: '#FFD54F' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, border: { dash: [4, 4] } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    // 3. Bar Chart (Sonar Code Debt)
    const sonarMetricsCtx = $('sonarMetricsChart');
    if (sonarMetricsCtx) {
      if (sonarMetricsChartInstance) sonarMetricsChartInstance.destroy();
      sonarMetricsChartInstance = new Chart(sonarMetricsCtx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: topSonar.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
          datasets: [
            { label: 'Vulnerabilities', data: topSonar.map(s => s.vulns), backgroundColor: '#FF4D4F' },
            { label: 'Bugs', data: topSonar.map(s => s.bugs), backgroundColor: '#FF9800' },
            { label: 'Code Smells', data: topSonar.map(s => s.smells), backgroundColor: '#00F5D4' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, border: { dash: [4, 4] } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }


  function openServiceDetailModal(svcId){
    detailServiceId = svcId; const svc = SERVICES.find(s=>s.id===svcId); if(!svc) return;
    const v = currentSprintData.vapt[svcId]; const s = currentSprintData.sonar[svcId]; const branch = currentSprintData.branches[svcId];
    const body = $('serviceDetailBody'); if(!body) return;

    body.innerHTML = `
      <div class="detail-header">
        <div class="detail-icon"><i class="fa-solid fa-cube"></i></div>
        <div class="detail-title">
          <h3>${escapeHtml(svc.name)}${svc.link?` <a href="${svc.link}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:''}</h3>
          <span class="branch-chip">${branch&&branch.name?escapeHtml(branch.name):'no branch set'}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span><i class="fa-solid fa-bug-slash"></i> VAPT Findings</span></div>
        ${v ? `
          <div class="detail-stats-grid">
            <div class="detail-stat stat-critical"><div class="num">${v.critical||0}</div><div class="lbl">Critical</div></div>
            <div class="detail-stat stat-high"><div class="num">${v.high||0}</div><div class="lbl">High</div></div>
            <div class="detail-stat stat-medium"><div class="num">${v.medium||0}</div><div class="lbl">Medium</div></div>
            <div class="detail-stat stat-low"><div class="num">${v.low||0}</div><div class="lbl">Low</div></div>
            <div class="detail-stat"><div class="num">${v.negligible||0}</div><div class="lbl">Negligible</div></div>
          </div>
          ${v.note ? `<div class="detail-note" style="margin-top:10px;">${escapeHtml(v.note)}</div>` : ''}
        ` : `<div class="detail-empty">No VAPT data recorded for this service.</div>`}
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span><i class="fa-solid fa-magnifying-glass-chart"></i> Sonar Scan</span></div>
        ${s ? `
          <div class="detail-ratings-grid">
            <div class="detail-rating-card"><span class="rating-pill ${RATING_CLASS[s.security]}">${s.security}</span><div class="lbl">Security</div></div>
            <div class="detail-rating-card"><span class="rating-pill ${RATING_CLASS[s.reliability]}">${s.reliability}</span><div class="lbl">Reliability</div></div>
            <div class="detail-rating-card"><span class="rating-pill ${RATING_CLASS[s.maintainability]}">${s.maintainability}</span><div class="lbl">Maintainability</div></div>
          </div>
          <div class="detail-metrics">
            <div class="detail-metric-row"><span class="metric-label">Coverage</span><div class="mini-progress"><span style="width:${s.coverage||0}%"></span></div><span class="metric-value">${s.coverage||0}%</span></div>
            <div class="detail-metric-row"><span class="metric-label">Duplications</span><div class="mini-progress"><span style="width:${s.duplications||0}%"></span></div><span class="metric-value">${s.duplications||0}%</span></div>
          </div>
        ` : `<div class="detail-empty">No Sonar scan recorded for this service.</div>`}
      </div>
    `;
    openModal('serviceDetailModal');
  }

  if($('detailEditVaptBtn')) $('detailEditVaptBtn').addEventListener('click', ()=>{ closeModal('serviceDetailModal'); openVaptModal(detailServiceId); });
  if($('detailEditSonarBtn')) $('detailEditSonarBtn').addEventListener('click', ()=>{ closeModal('serviceDetailModal'); openSonarModal(detailServiceId); });

  function openVaptModal(id){
    currentEditService = id; const svc = SERVICES.find(s=>s.id===id); if(!svc) return;
    if($('vaptModalTitle')) $('vaptModalTitle').textContent = 'VAPT — ' + svc.name;
    const data = currentSprintData.vapt[id] || {}; const branch = currentSprintData.branches[id] || {};
    if($('f_critical')) $('f_critical').value = data.critical||0;
    if($('f_high')) $('f_high').value = data.high||0;
    if($('f_medium')) $('f_medium').value = data.medium||0;
    if($('f_low')) $('f_low').value = data.low||0;
    if($('f_negligible')) $('f_negligible').value = data.negligible||0;
    if($('f_note')) $('f_note').value = data.note||'';
    if($('f_branch')) $('f_branch').value = branch.name||'';
    openModal('vaptModal');
  }
  
  if($('saveVaptBtn')){
    $('saveVaptBtn').addEventListener('click', async ()=>{
      if(!currentEditService) return;
      currentSprintData.vapt[currentEditService] = { critical: Number($('f_critical').value)||0, high: Number($('f_high').value)||0, medium: Number($('f_medium').value)||0, low: Number($('f_low').value)||0, negligible: Number($('f_negligible').value)||0, note: $('f_note').value.trim(), updatedAt: Date.now() };
      currentSprintData.branches[currentEditService] = { name: $('f_branch').value.trim() };
      await persistCurrentSprintData(); closeModal('vaptModal'); await renderAll(); showToast('VAPT data saved');
    });
  }

  function openSonarModal(id){
    currentEditService = id; const svc = SERVICES.find(s=>s.id===id); if(!svc) return;
    if($('sonarModalTitle')) $('sonarModalTitle').textContent = 'Sonar scan — ' + svc.name;
    const data = currentSprintData.sonar[id] || {}; const branch = currentSprintData.branches[id] || {};
    if($('s_security')) $('s_security').value = data.security||'A';
    if($('s_reliability')) $('s_reliability').value = data.reliability||'A';
    if($('s_maintainability')) $('s_maintainability').value = data.maintainability||'A';
    if($('s_security_num')) $('s_security_num').value = data.securityNum||0;
    if($('s_reliability_num')) $('s_reliability_num').value = data.reliabilityNum||0;
    if($('s_maintainability_num')) $('s_maintainability_num').value = data.maintainabilityNum||0;
    if($('s_hotspots')) $('s_hotspots').value = data.hotspots||0;
    if($('s_coverage')) $('s_coverage').value = data.coverage||0;
    if($('s_duplications')) $('s_duplications').value = data.duplications||0;
    if($('s_branch')) $('s_branch').value = branch.name||'';
    openModal('sonarModal');
  }

  if($('saveSonarBtn')){
    $('saveSonarBtn').addEventListener('click', async ()=>{
      if(!currentEditService) return;
      currentSprintData.sonar[currentEditService] = { security: $('s_security').value, reliability: $('s_reliability').value, maintainability: $('s_maintainability').value, securityNum: Number($('s_security_num').value)||0, reliabilityNum: Number($('s_reliability_num').value)||0, maintainabilityNum: Number($('s_maintainability_num').value)||0, hotspots: Number($('s_hotspots').value)||0, coverage: Number($('s_coverage').value)||0, duplications: Number($('s_duplications').value)||0, updatedAt: Date.now() };
      currentSprintData.branches[currentEditService] = { name: $('s_branch').value.trim() };
      await persistCurrentSprintData(); closeModal('sonarModal'); await renderAll(); showToast('Sonar data saved');
    });
  }

  // ===================== COMPARISON LOGIC =====================
  
  function populateComparisonDropdowns() {
    const selA = $('compSprintA'); const selB = $('compSprintB'); const selSvc = $('compServiceTarget');
    if(!selA || !selB || !selSvc) return;
    
    selA.innerHTML = ''; selB.innerHTML = '';
    sprints.forEach(s => {
      selA.innerHTML += `<option value="${s}">${s}</option>`;
      selB.innerHTML += `<option value="${s}">${s}</option>`;
    });

    if(sprints.length > 1) {
      selA.value = sprints[sprints.length - 2];
      selB.value = sprints[sprints.length - 1];
    } else if (sprints.length === 1) {
      selA.value = sprints[0]; selB.value = sprints[0];
    }

    selSvc.innerHTML = '<option value="ALL">All Services</option>';
    SERVICES.forEach(svc => { selSvc.innerHTML += `<option value="${svc.id}">${escapeHtml(svc.name)}</option>`; });
  }

  async function generateComparison() {
    const resultsBox = $('comparisonResults'); if(!resultsBox) return;
    const sA = $('compSprintA') ? $('compSprintA').value : null;
    const sB = $('compSprintB') ? $('compSprintB').value : null;
    const svcId = $('compServiceTarget') ? $('compServiceTarget').value : 'ALL';

    if (!sA || !sB) { resultsBox.innerHTML = '<div class="detail-empty">Need at least two sprints to compare.</div>'; return; }

    const dataA = await storageGet(sprintDataKey(sA)) || emptySprintData();
    const dataB = await storageGet(sprintDataKey(sB)) || emptySprintData();

    let metricsA = { critical:0, high:0, medium:0, low:0, coverageSum:0, covCount:0, vulns:0, bugs:0, smells:0 };
    let metricsB = { critical:0, high:0, medium:0, low:0, coverageSum:0, covCount:0, vulns:0, bugs:0, smells:0 };

    const targetServices = svcId === 'ALL' ? SERVICES : SERVICES.filter(s => s.id === svcId);

    targetServices.forEach(svc => {
      const vA = dataA.vapt?.[svc.id] || {}; const sA_sonar = dataA.sonar?.[svc.id] || {};
      const vB = dataB.vapt?.[svc.id] || {}; const sB_sonar = dataB.sonar?.[svc.id] || {};

      metricsA.critical += Number(vA.critical||0); metricsB.critical += Number(vB.critical||0);
      metricsA.high += Number(vA.high||0); metricsB.high += Number(vB.high||0);
      metricsA.medium += Number(vA.medium||0); metricsB.medium += Number(vB.medium||0);
      metricsA.low += Number(vA.low||0); metricsB.low += Number(vB.low||0);

      if(sA_sonar.coverage !== undefined) { metricsA.coverageSum += Number(sA_sonar.coverage||0); metricsA.covCount++; }
      if(sB_sonar.coverage !== undefined) { metricsB.coverageSum += Number(sB_sonar.coverage||0); metricsB.covCount++; }
      
      metricsA.vulns += Number(sA_sonar.securityNum||0); metricsB.vulns += Number(sB_sonar.securityNum||0);
      metricsA.bugs += Number(sA_sonar.reliabilityNum||0); metricsB.bugs += Number(sB_sonar.reliabilityNum||0);
      metricsA.smells += Number(sA_sonar.maintainabilityNum||0); metricsB.smells += Number(sB_sonar.maintainabilityNum||0);
    });

    const covA = metricsA.covCount ? Math.round(metricsA.coverageSum/metricsA.covCount) : 0;
    const covB = metricsB.covCount ? Math.round(metricsB.coverageSum/metricsB.covCount) : 0;

    function renderDiffCard(label, valA, valB, badIfRising = true) {
      const diff = valB - valA;
      let trendClass = 'neutral', icon = 'fa-minus', trendText = 'Unchanged';
      if (diff > 0) { trendClass = badIfRising ? 'bad' : 'good'; icon = 'fa-arrow-up'; trendText = `+${diff}`; }
      else if (diff < 0) { trendClass = badIfRising ? 'good' : 'bad'; icon = 'fa-arrow-down'; trendText = `${diff}`; }

      return `
        <div class="diff-card">
          <div class="lbl">${label}</div>
          <div class="vals">
            <span style="color:var(--text-secondary)">${valA}</span>
            <i class="fa-solid fa-arrow-right-long arrow"></i>
            <span style="color:var(--text-primary)">${valB}</span>
          </div>
          <div class="delta ${trendClass}"><i class="fa-solid ${icon}"></i> ${trendText}</div>
        </div>
      `;
    }

    resultsBox.innerHTML = `
      <div class="detail-section-title"><span><i class="fa-solid fa-bug-slash"></i> VAPT Delta</span></div>
      <div class="comparison-diff-grid">
        ${renderDiffCard('Critical Issues', metricsA.critical, metricsB.critical, true)}
        ${renderDiffCard('High Issues', metricsA.high, metricsB.high, true)}
        ${renderDiffCard('Medium Issues', metricsA.medium, metricsB.medium, true)}
        ${renderDiffCard('Low Issues', metricsA.low, metricsB.low, true)}
      </div>

      <div class="detail-section-title" style="margin-top:20px;"><span><i class="fa-solid fa-magnifying-glass-chart"></i> Sonar Scan Delta</span></div>
      <div class="comparison-diff-grid">
        ${renderDiffCard('Vulnerabilities', metricsA.vulns, metricsB.vulns, true)}
        ${renderDiffCard('Reliability', metricsA.bugs, metricsB.bugs, true)}
        ${renderDiffCard('Maintainability', metricsA.smells, metricsB.smells, true)}
        ${renderDiffCard('Test Coverage %', covA, covB, false)}
      </div>
    `;
  }

  ['compSprintA', 'compSprintB', 'compServiceTarget'].forEach(id => {
    if($(id)) $(id).addEventListener('change', generateComparison);
  });

  async function init(){
    await loadCustomServices();
    sprints = await storageGet('sprints') || [];
    if(sprints.length) activeSprint = sprints[sprints.length-1];
    populateSprintSelect();
    await renderAll();
  }
  init();
})();
