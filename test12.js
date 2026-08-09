import fs from 'fs';
import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;

const xmlText = fs.readFileSync('test.xml', 'utf-8');
const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
const mxCells = Array.from(doc.querySelectorAll('mxCell'));
console.log('mxCells:', mxCells.length);
