import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;
const xml = `
<mxCell id="node_1" vertex="1" parent="1">
  <mxGeometry x="60" y="20" width="730" height="50" as="geometry" />
</mxCell>`;
const doc = new DOMParser().parseFromString(xml, 'text/xml');
const c = doc.querySelector('mxCell');
console.log(c.outerHTML || new JSDOM().window.XMLSerializer.prototype.serializeToString.call(new JSDOM().window, c));
console.log(c.getAttribute('vertex'));
console.log(c.querySelector('mxGeometry'));
