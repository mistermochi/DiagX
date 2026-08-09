import fs from 'fs';
import { JSDOM } from 'jsdom';
import { processDrawioToDocx } from './src/lib/converter';

global.DOMParser = new JSDOM().window.DOMParser as any;

async function run() {
    const xmlText = fs.readFileSync('test.xml', 'utf-8');
    const buffer = new TextEncoder().encode(xmlText).buffer;
    const { blob, stats } = await processDrawioToDocx(buffer);
    console.log('stats:', stats);
    // write to disk
    const arr = await blob.arrayBuffer();
    fs.writeFileSync('output.docx', new Uint8Array(arr));
}
run();
