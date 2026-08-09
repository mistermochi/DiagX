import fs from 'fs';
import { JSDOM } from 'jsdom';
const DOMParser = new JSDOM().window.DOMParser;
const xml = `<mxfile host="app.diagrams.net">
  <diagram id="unique" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="n1" vertex="1" parent="1"><mxGeometry x="300" y="100" width="200" height="60" as="geometry" /></mxCell>
        <mxCell id="n2" vertex="1" parent="1"><mxGeometry x="100" y="250" width="120" height="60" as="geometry" /></mxCell>
        <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;" edge="1" parent="1" source="n1" target="n2">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="160" y="200" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

// Let's implement logic to insert bends if segments are not orthogonal
function fixOrthogonalBends(path) {
    let newPath = [path[0]];
    for (let i = 1; i < path.length; i++) {
        let prev = newPath[newPath.length - 1];
        let curr = path[i];
        if (Math.abs(prev[0] - curr[0]) > 1e-6 && Math.abs(prev[1] - curr[1]) > 1e-6) {
            // Not orthogonal! Need to insert a bend.
            // But which way? 
            // If this is the segment from startPt to pts[0]
            // We can look at the next segment to decide?
            // Actually, for 1 waypoint, the control point is usually the elbow.
            // E.g. [400, 130] -> [160, 200] -> [160, 280]
            // The segment [160, 200] -> [160, 280] is vertical.
            // So the segment before it should be horizontal!
            // But [400, 130] -> [160, 200] is diagonal.
            // To make it horizontal, we need a vertical segment before it.
            // So [400, 130] -> [400, 200] -> [160, 200]
            
            // So if prev -> curr is diagonal, we add [prev[0], curr[1]] or [curr[0], prev[1]]
            // How to decide?
            // If it's the first segment, and the next segment is vertical, we add [prev[0], curr[1]] (go vertical first, then horizontal)
            let next = i + 1 < path.length ? path[i+1] : null;
            let insertVerticalFirst = true; // default
            if (next) {
                if (Math.abs(curr[0] - next[0]) < 1e-6) {
                    // Next is vertical, so the one ending at curr must be horizontal.
                    // So we must go vertical first, then horizontal to curr.
                    // [prev[0], curr[1]]
                    insertVerticalFirst = true;
                } else {
                    insertVerticalFirst = false;
                }
            } else if (i > 1) {
                let prevPrev = newPath[newPath.length - 2];
                if (Math.abs(prevPrev[0] - prev[0]) < 1e-6) {
                    // previous was vertical, so this one should start horizontal
                    insertVerticalFirst = false;
                }
            }
            
            if (insertVerticalFirst) {
                newPath.push([prev[0], curr[1]]);
            } else {
                newPath.push([curr[0], prev[1]]);
            }
        }
        newPath.push(curr);
    }
    return newPath;
}

// Current pts logic
const startPt = [400, 130];
const endPt = [160, 280];
const pts = [[160, 200]];

const p1 = pts[0];
const p2 = pts.length > 1 ? pts[1] : endPt;
if (Math.abs(p1[0] - p2[0]) > Math.abs(p1[1] - p2[1])) startPt[0] = p1[0];
else startPt[1] = p1[1];

const plast = pts[pts.length - 1];
const pprev = pts.length > 1 ? pts[pts.length - 2] : startPt;
if (Math.abs(plast[0] - pprev[0]) > Math.abs(plast[1] - pprev[1])) endPt[0] = plast[0];
else endPt[1] = plast[1];

let path = [startPt, ...pts, endPt];
console.log("Raw path:", path);
console.log("Fixed path:", fixOrthogonalBends(path));

