import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;
const clean = `<mxfile host="app.diagrams.net" modified="2026-07-18T00:00:00.000Z" agent="GeminiConverter" version="24.7.17" type="device">
  <diagram id="unique_diagram_id" name="Page-1">
    <mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const doc = new DOMParser().parseFromString(clean, 'text/xml');
const diagram = doc.querySelector('diagram');
console.log('diagram.textContent:', diagram.textContent);
