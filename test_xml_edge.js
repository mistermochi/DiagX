import fs from 'fs';
import { JSDOM } from 'jsdom';
import { edgePoints } from './src/lib/converter.js';

const DOMParser = new JSDOM().window.DOMParser;
global.DOMParser = DOMParser;

const xml = `<mxfile>
  <diagram>
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2eFBD_GNof589YkygfQO-2" value="視障人士" vertex="1" parent="1">
          <mxGeometry x="40" y="110" width="180" height="40" as="geometry" />
        </mxCell>
        <mxCell id="2eFBD_GNof589YkygfQO-17" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;" target="2eFBD_GNof589YkygfQO-2">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="395" y="90" as="sourcePoint" />
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const doc = new DOMParser().parseFromString(xml, 'text/xml');
const cells = new Map();
for (const c of doc.querySelectorAll('mxCell')) {
    if (c.id) cells.set(c.id, c);
}
const edge = cells.get('2eFBD_GNof589YkygfQO-17');
console.log(edgePoints(edge, cells));
