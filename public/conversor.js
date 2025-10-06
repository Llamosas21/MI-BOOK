const viewer = document.getElementById('viewer');
const pageNumber = document.getElementById('pageNumber');  
let currentPage = 0;
let totalPages = 0;

// Para detectar doble click para ir hacia atrás
let lastClickTime = 0;

document.addEventListener('DOMContentLoaded', () => {
  const bookPath = window.bookPath;
  if (bookPath) handleFiles(bookPath);
});

async function handleFiles(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const ab = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const getText = async (p) => zip.file(p).async('string');

    const containerPath = Object.keys(zip.files).find(p => p.toLowerCase() === 'meta-inf/container.xml');
    if (!containerPath) return alert('No se encontró container.xml');

    const containerXml = await getText(containerPath);
    const opfPath = (new DOMParser())
      .parseFromString(containerXml,'application/xml')
      .querySelector('rootfile')?.getAttribute('full-path');
    if(!opfPath) return alert('No se encontró el .opf');

    const opfXml = await getText(opfPath);
    const opfDoc = (new DOMParser()).parseFromString(opfXml,'application/xml');

    const manifest = {};
    opfDoc.querySelectorAll('manifest > item').forEach(it=>{
      manifest[it.getAttribute('id')] = {
        href: it.getAttribute('href'),
        type: it.getAttribute('media-type')||''
      };
    });

    const baseDir = opfPath.split('/').slice(0,-1).join('/');
    const resolveHref = (h) => baseDir ? `${baseDir}/${h}`.replace(/\/+/g,'/') : h;

    const spineIds = Array.from(opfDoc.querySelectorAll('spine > itemref'))
      .map(n => n.getAttribute('idref'))
      .filter(Boolean);

    viewer.innerHTML = '';

    // Ajuste de palabras por página según ancho
    let wordsPerPage;
    const width = window.innerWidth;
    if(width <= 480) wordsPerPage = 250;     
    else if(width <= 768) wordsPerPage = 400; 
    else wordsPerPage = 500;                

    for(const id of spineIds){
      const item = manifest[id];
      if(!item) continue;

      const href = resolveHref(item.href);
      if(!/html|xhtml|\.html?$|\.xhtml$/i.test(item.type) && !/\.xhtml?$/.test(href)) continue;

      const html = await getText(href);
      const doc = new DOMParser().parseFromString(html,'text/html');
      const lines = doc.body?.textContent.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if(!lines || !lines.length) continue;

      let currentWords = [];
      for(const line of lines){
        const lineWords = line.split(' ').filter(Boolean);
        for(const word of lineWords){
          currentWords.push(word);

          if(currentWords.length >= wordsPerPage){
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.innerText = currentWords.join(' ');
            viewer.appendChild(pageDiv);
            currentWords = [];
          }
        }
      }

      if(currentWords.length){
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.innerText = currentWords.join(' ');
        viewer.appendChild(pageDiv);
      }
    }

    totalPages = viewer.children.length;
    currentPage = 0;

    Array.from(viewer.children).forEach((p,i)=>{
      p.style.display = i===0 ? 'block' : 'none';
      p.scrollTop = 0;
    });

    viewer.style.display = 'block';
    updatePageNumber();
    checkScrollIndicator(viewer.children[currentPage]);

  } catch(error){
    console.error(error);
    alert('Error al cargar el libro: ' + error.message);
  }
}

function changePage(newIndex){
  if(newIndex<0 || newIndex>=viewer.children.length) return;

  const oldPage = viewer.children[currentPage];
  oldPage.classList.add('fade-out');

  setTimeout(()=>{
    oldPage.style.display = 'none';
    oldPage.classList.remove('fade-out');

    currentPage = newIndex;
    const newPage = viewer.children[currentPage];
    newPage.style.display = 'block';
    newPage.scrollTop = 0;
    newPage.classList.add('fade-in');
    setTimeout(()=>newPage.classList.remove('fade-in'), 400);

    updatePageNumber();
    checkScrollIndicator(newPage);
  }, 300);
}

// Rebote si intenta pasar sin llegar al final
function tryNextPage(){
  const page = viewer.children[currentPage];
  if(canScrollForward(page)){
    changePage(currentPage + 1);
  } else {
    page.classList.add('bounce-scroll');
    setTimeout(()=>page.classList.remove('bounce-scroll'), 500);
  }
}

function updatePageNumber(){
  if(!pageNumber) return;
  pageNumber.innerText = `${currentPage + 1} / ${totalPages}`;
}

// Detectar scroll para permitir avanzar
function canScrollForward(page) {
  return page.scrollTop + page.clientHeight >= page.scrollHeight - 5;
}

// Mostrar indicador ▼ mientras no llega al fondo
function checkScrollIndicator(page){
  if(page.scrollTop + page.clientHeight >= page.scrollHeight - 5){
    page.classList.add('at-bottom');
  } else {
    page.classList.remove('at-bottom');
  }
}

// Eventos
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'd') tryNextPage();
  if (e.key === 'ArrowLeft' || e.key === 'a') {
    const now = Date.now();
    if(now - lastClickTime < 400) { 
      changePage(currentPage - 1);
      lastClickTime = 0;
    } else lastClickTime = now;
  }
});

let touchStartX = 0;
viewer.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
viewer.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const diff = touchStartX - touchEndX;
  if(Math.abs(diff) > 50){
    if(diff>0) tryNextPage();
    else {
      const now = Date.now();
      if(now - lastClickTime < 400) { 
        changePage(currentPage - 1);
        lastClickTime = 0;
      } else lastClickTime = now;
    }
  }
});

viewer.addEventListener('click', (e) => {
  const x = e.clientX - viewer.getBoundingClientRect().left;
  const width = viewer.offsetWidth;
  if(x > width * 0.7) tryNextPage();
  else if(x < width * 0.3){
    const now = Date.now();
    if(now - lastClickTime < 400) { 
      changePage(currentPage - 1);
      lastClickTime = 0;
    } else lastClickTime = now;
  }
});

viewer.addEventListener('scroll', () => {
  const page = viewer.children[currentPage];
  checkScrollIndicator(page);
});
