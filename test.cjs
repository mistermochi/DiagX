const { JSDOM } = require("jsdom");
const dom = new JSDOM();
const parser = new dom.window.DOMParser();

const xml = `<mxfile host="app.diagrams.net" modified="2026-07-18T00:00:00.000Z" agent="GeminiConverter" version="24.7.17" type="device">
  <diagram id="unique_diagram_id" name="Page-1">
    <mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="node_1" value="Test" style="rounded=1;" vertex="1" parent="1">
          <mxGeometry x="60" y="20" width="730" height="50" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const doc = parser.parseFromString(xml, 'text/xml');
const cells = doc.querySelectorAll('mxCell');
console.log(cells.length);
const vertices = Array.from(cells).filter(c => c.getAttribute('vertex') === '1' && c.querySelector('mxGeometry'));
console.log(vertices.length);
