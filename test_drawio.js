import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;
const xml = `<mxfile>
  <diagram>
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="n1" vertex="1" parent="1"><mxGeometry x="100" y="100" width="100" height="50" as="geometry"/></mxCell>
        <mxCell id="n2" vertex="1" parent="1"><mxGeometry x="300" y="300" width="100" height="50" as="geometry"/></mxCell>
        <mxCell id="e1" edge="1" style="edgeStyle=orthogonalEdgeStyle;" parent="1" source="n1" target="n2">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="150" y="325" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
// If the user drags a line, the waypoint is typically a single corner.
// e.g. x=150 (center of n1), y=325 (center of n2).
// In that case sx=150, sy=125. px=150, py=325. sx==px!
