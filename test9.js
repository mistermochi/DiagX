import JSZip from 'jszip';
import fs from 'fs';

async function generateDocxBlob(documentXml) {
    const contentTypes = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
        `</Types>`
    );
    const rels = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
        `</Relationships>`
    );
    const core = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
        `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
        `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:creator>drawio2docx</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">2026-08-08T00:00:00Z</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">2026-08-08T00:00:00Z</dcterms:modified>` +
        `</cp:coreProperties>`
    );
    const app = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
        `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
        `<Application>drawio2docx converter</Application>` +
        `</Properties>`
    );
    
    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rels);
    zip.file('word/document.xml', documentXml);
    zip.file('docProps/core.xml', core);
    zip.file('docProps/app.xml', app);
    
    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function run() {
    const documentXml = fs.readFileSync('output.xml', 'utf-8');
    const buf = await generateDocxBlob(documentXml);
    fs.writeFileSync('output.docx', buf);
    console.log('Size:', buf.length);
}
run();
