import fs from 'fs';
import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;

const xmlText = fs.readFileSync('test.xml', 'utf-8');
const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
const mxCells = Array.from(doc.querySelectorAll('mxCell'));
const vertices = mxCells.filter(c => c.getAttribute('vertex') === '1' && c.querySelector('mxGeometry'));
console.log('vertices:', vertices.length);
