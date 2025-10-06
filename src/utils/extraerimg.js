import JSZip from 'jszip';

export async function extraerPortada(epubPath) {
  const response = await fetch(epubPath);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const ab = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const getText = async (p) => zip.file(p).async('string');
  const getBlob = async (p) => zip.file(p).async('blob');

  // Container
  const containerPath = Object.keys(zip.files).find(p => p.toLowerCase() === 'meta-inf/container.xml');
  if (!containerPath) return null;

  const containerXml = await getText(containerPath);
  const opfPath = new DOMParser()
      .parseFromString(containerXml, 'application/xml')
      .querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) return null;

  const opfXml = await getText(opfPath);
  const opfDoc = new DOMParser().parseFromString(opfXml,'application/xml');

  // Buscar portada en manifest
  let coverHref = null;
  const metaCover = opfDoc.querySelector('meta[name="cover"]')?.getAttribute('content');
  if(metaCover){
    coverHref = opfDoc.querySelector(`#${metaCover}`)?.getAttribute('href');
  } else {
    // Alternativa: buscar id que contenga "cover"
    const coverItem = Array.from(opfDoc.querySelectorAll('manifest > item'))
      .find(i => /cover/i.test(i.getAttribute('id')));
    coverHref = coverItem?.getAttribute('href');
  }

  if(!coverHref) return null;

  const baseDir = opfPath.split('/').slice(0,-1).join('/');
  const coverPath = baseDir ? `${baseDir}/${coverHref}`.replace(/\/+/g,'/') : coverHref;
  
  const blob = await getBlob(coverPath);
  return URL.createObjectURL(blob); // Devuelve un link tipo "blob:" usable como <img src>
}
