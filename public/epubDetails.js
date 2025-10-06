async function extractEpubDetails(epubPath) {
    try {
        const response = await fetch(epubPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const ab = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(ab);
        const getText = async (p) => zip.file(p).async('string');

        // Función para limpiar HTML y dejar solo texto plano
        const stripHtml = (htmlString) => {
            if (!htmlString) return '';
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            return doc.body.textContent.trim().replace(/\s+/g, ' ');
        };

        // Buscar container.xml
        const containerPath = Object.keys(zip.files)
            .find(p => p.toLowerCase() === 'meta-inf/container.xml');
        if (!containerPath) throw new Error('No se encontró container.xml');

        const containerXml = await getText(containerPath);
        const opfPath = new DOMParser()
            .parseFromString(containerXml, 'application/xml')
            .querySelector('rootfile')?.getAttribute('full-path');
        if (!opfPath) throw new Error('No se encontró el archivo OPF');

        // Leer archivo OPF
        const opfXml = await getText(opfPath);
        const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

        // Extraer metadatos
        const metadata = {
            title: opfDoc.querySelector('dc\\:title, title')?.textContent?.trim() || 'Sin título',
            author: opfDoc.querySelector('dc\\:creator, creator')?.textContent?.trim() || 'Desconocido',
            description: stripHtml(opfDoc.querySelector('dc\\:description, description')?.textContent) || '',
            language: opfDoc.querySelector('dc\\:language, language')?.textContent?.trim() || '',
            rights: opfDoc.querySelector('dc\\:rights, rights')?.textContent?.trim() || '',
            date: opfDoc.querySelector('dc\\:date, date')?.textContent?.trim() || '',
            image: ''
        };

        // Extraer imagen de portada si existe
        const coverId = opfDoc.querySelector('meta[name="cover"]')?.getAttribute('content');
        if (coverId) {
            const coverItem = opfDoc.querySelector(`manifest > item[id="${coverId}"]`);
            if (coverItem) {
                const baseDir = opfPath.split('/').slice(0, -1).join('/');
                metadata.image = baseDir ? `${baseDir}/${coverItem.getAttribute('href')}` : coverItem.getAttribute('href');
            }
        }

        // Si no hay descripción, extraer del primer capítulo
        if (!metadata.description) {
            const spineIds = Array.from(opfDoc.querySelectorAll('spine > itemref'))
                .map(n => n.getAttribute('idref')).filter(Boolean);

            const manifest = {};
            opfDoc.querySelectorAll('manifest > item').forEach(it => {
                manifest[it.getAttribute('id')] = {
                    href: it.getAttribute('href'),
                    type: it.getAttribute('media-type') || ''
                };
            });

            const baseDir = opfPath.split('/').slice(0, -1).join('/');
            const resolveHref = (h) => baseDir ? `${baseDir}/${h}`.replace(/\/+/g, '/') : h;

            for (const id of spineIds) {
                const item = manifest[id];
                if (!item) continue;
                if (!/html|xhtml|\.html?$|\.xhtml$/i.test(item.type) && !/\.xhtml?$/.test(item.href)) continue;

                const html = await getText(resolveHref(item.href));
                metadata.description = stripHtml(html).slice(0, 500) + '...';
                break;
            }
        }

        return metadata;

    } catch (error) {
        console.error('Error extrayendo detalles del EPUB:', error);
        return {
            title: 'Error al leer EPUB',
            author: 'Desconocido',
            description: '',
            language: '',
            rights: '',
            date: '',
            image: ''
        };
    }
}
