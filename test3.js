import { JSDOM } from 'jsdom';
global.DOMParser = new JSDOM().window.DOMParser;
import fs from 'fs';
import * as fflate from 'fflate';

// Just copy processDrawioToDocx and its dependencies here to debug
const EMU = 9525; // px -> EMU at 96 dpi

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

function parseStyle(s) {
    const out = {};
    if (!s) return out;
    for (let part of s.split(';')) {
        part = part.trim();
        if (!part) continue;
        const eqIdx = part.indexOf('=');
        if (eqIdx !== -1) {
            out[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
        } else {
            out[part] = '1';
        }
    }
    return out;
}

function geomOf(cell) {
    const g = cell.querySelector('mxGeometry');
    if (!g) return null;
    return [
        parseFloat(g.getAttribute('x') || '0'),
        parseFloat(g.getAttribute('y') || '0'),
        parseFloat(g.getAttribute('width') || '0'),
        parseFloat(g.getAttribute('height') || '0')
    ];
}

function anchorOf(cell, ex, ey) {
    const geom = geomOf(cell);
    if (!geom) return null;
    const [x, y, w, h] = geom;
    const fex = ex != null ? parseFloat(ex) : 0.5;
    const fey = ey != null ? parseFloat(ey) : 0.5;
    return [x + fex * w, y + fey * h];
}

function color6(v, def = '000000') {
    if (!v) return def;
    v = v.replace(/^#/, '');
    if (v.length === 6) return v.toUpperCase();
    if (v.length === 3) return v.split('').map(c => c + c).join('').toUpperCase();
    return def;
}

const TAG_RE = /(<\/?(?:b|strong|i|em|u)(?:\s*\/?>))/i;
const DIV_OPEN = /<div\b([^>]*)>/i;
const DIV_CLOSE = /<\/div\s*>/i;
const BR_RE = /<br\s*\/?>/i;

function parseRuns(raw) {
    const runs = [];
    let bold = false;
    let italic = false;
    const parts = raw.split(TAG_RE);
    for (const part of parts) {
        if (!part) continue;
        const pl = part.toLowerCase().trim();
        if (pl === '<b>' || pl === '<strong>') bold = true;
        else if (pl === '</b>' || pl === '</strong>') bold = false;
        else if (pl === '<i>' || pl === '<em>') italic = true;
        else if (pl === '</i>' || pl === '</em>') italic = false;
        else runs.push({ text: part, bold, italic });
    }
    return runs;
}

function parseValue(value) {
    const lines = [];
    const stack = [];
    let buf = [];

    const flush = () => {
        if (buf.length > 0) {
            const line = buf.join('');
            const subs = line.split(BR_RE);
            for (let sub of subs) {
                sub = sub.trim();
                if (sub) {
                    const align = stack.length > 0 ? stack[stack.length - 1] : null;
                    lines.push([align, parseRuns(sub)]);
                }
            }
            buf = [];
        }
    };

    let i = 0;
    while (i < value.length) {
        let match = value.substring(i).match(DIV_OPEN);
        if (match && match.index === 0) {
            flush();
            const st = (match[1] || '').replace(/ /g, '');
            stack.push(st.includes('text-align:center') ? 'center' : null);
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(DIV_CLOSE);
        if (match && match.index === 0) {
            flush();
            if (stack.length > 0) stack.pop();
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(BR_RE);
        if (match && match.index === 0) {
            flush();
            i += match[0].length;
            continue;
        }
        buf.push(value[i]);
        i++;
    }
    flush();
    return lines;
}

function textParagraphs(lines, fontSize, halfW) {
    const out = [];
    for (const [align, runs] of lines) {
        let ppr = '<w:pPr>';
        if (align === 'center') {
            ppr += '<w:jc w:val="center"/>';
        }
        ppr += '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>';
        const bits = [];
        for (const { text, bold, italic } of runs) {
            let rpr = `<w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:eastAsia="Microsoft JhengHei"/>`;
            if (bold) rpr += '<w:b/>';
            if (italic) rpr += '<w:i/>';
            rpr += `<w:sz w:val="${halfW}"/><w:szCs w:val="${halfW}"/><w:color w:val="000000"/></w:rPr>`;
            bits.push(`<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`);
        }
        out.push(bits.length ? `<w:p>${ppr}${bits.join('')}</w:p>` : `<w:p>${ppr}</w:p>`);
    }
    return out.length ? out.join('') : '<w:p/>';
}

function anchorWrap(z, name, x, y, w, h, wspXml, behind = 0) {
    const cx = Math.max(1, Math.round(w * EMU));
    const cy = Math.max(1, Math.round(h * EMU));
    // prevent negative posOffset
    const posX = Math.max(0, Math.round(x * EMU));
    const posY = Math.max(0, Math.round(y * EMU));
    return (
        `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" ` +
        `simplePos="0" relativeHeight="${z}" behindDoc="${behind}" locked="0" ` +
        `layoutInCell="1" allowOverlap="1">` +
        `<wp:simplePos x="0" y="0"/>` +
        `<wp:positionH relativeFrom="page"><wp:posOffset>${posX}</wp:posOffset></wp:positionH>` +
        `<wp:positionV relativeFrom="page"><wp:posOffset>${posY}</wp:posOffset></wp:positionV>` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:wrapNone/>` +
        `<wp:docPr id="${z}" name="${esc(name.substring(0, 80))}"/>` +
        `<wp:cNvGraphicFramePr/>` +
        `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">` +
        `${wspXml}` +
        `</a:graphicData></a:graphic></wp:anchor></w:drawing>`
    );
}

function shapeXml(wspInner) {
    return `<wps:wsp><wps:cNvSpPr/>${wspInner}</wps:wsp>`;
}

function vertexXml(cell, z, name) {
    const style = parseStyle(cell.getAttribute('style') || '');
    const g = geomOf(cell);
    if (!g) return null;
    const [x, y, w, h] = g;
    const value = cell.getAttribute('value') || '';
    const fill = color6(style['fillColor'], 'ffffff');
    const stroke = color6(style['strokeColor'], '000000');
    const sw = parseFloat(style['strokeWidth'] || '1') || 1.0;
    const fs = parseFloat(style['fontSize'] || '12') || 12.0;
    const halfW = Math.round(fs * 2);
    const rounded = style['rounded'] === '1';
    
    let valign = 'ctr';
    if (style['verticalAlign'] === 'top') valign = 't';
    else if (style['verticalAlign'] === 'bottom') valign = 'b';
    
    const spLeft = style['spacingLeft'];
    const lins = spLeft ? Math.round(parseFloat(spLeft) * EMU) : 0;

    const lines = value ? parseValue(value) : [];
    
    const prst = rounded ? 'roundRect' : 'rect';
    const spPr = (
        `<wps:spPr>` +
        `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/></a:xfrm>` +
        `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>` +
        `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` +
        `<a:ln w="${Math.round(sw * 12700)}" cap="flat" cmpd="sng" algn="ctr">` +
        `<a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln>` +
        `</wps:spPr>`
    );

    let txbx = '';
    if (lines.length > 0) {
        txbx = `<wps:txbx><w:txbxContent>${textParagraphs(lines, fs, halfW)}</w:txbxContent></wps:txbx>`;
    }
    const bodypr = `<wps:bodyPr wrap="square" lIns="${lins}" tIns="0" rIns="0" bIns="0" anchor="${valign}" vert="horz"/>`;
    return anchorWrap(z, name, x, y, w, h, shapeXml(spPr + txbx + bodypr));
}

function edgePoints(cell, cells) {
    const style = parseStyle(cell.getAttribute('style') || '');
    const srcId = cell.getAttribute('source');
    const tgtId = cell.getAttribute('target');
    const g = cell.querySelector('mxGeometry');
    const pts = [];
    let sp = null;
    let tp = null;
    
    if (g) {
        for (const ch of Array.from(g.children)) {
            if (ch.tagName === 'Array') {
                for (const p of Array.from(ch.querySelectorAll('mxPoint'))) {
                    pts.push([parseFloat(p.getAttribute('x') || '0'), parseFloat(p.getAttribute('y') || '0')]);
                }
            } else if (ch.tagName === 'mxPoint') {
                const as_ = ch.getAttribute('as');
                const xy = [parseFloat(ch.getAttribute('x') || '0'), parseFloat(ch.getAttribute('y') || '0')];
                if (as_ === 'sourcePoint') sp = xy;
                else if (as_ === 'targetPoint') tp = xy;
            }
        }
    }

    let start = null;
    let end = null;
    
    if (srcId && cells.has(srcId)) {
        start = anchorOf(cells.get(srcId), style['exitX'], style['exitY']);
    } else if (sp) {
        start = sp;
    }
    
    if (tgtId && cells.has(tgtId)) {
        end = anchorOf(cells.get(tgtId), style['entryX'], style['entryY']);
    } else if (tp) {
        end = tp;
    }
    
    if (!start || !end) return null;
    
    const sx = start[0], sy = start[1];
    const ex = end[0], ey = end[1];
    let path = [];
    
    if (pts.length > 0) {
        path = [start, ...pts, end];
    } else if (Math.abs(sx - ex) < 1e-6 || Math.abs(sy - ey) < 1e-6) {
        path = [start, end];
    } else if (style['exitY'] != null || style['exitX'] != null) {
        if (style['exitY'] != null) path = [start, [sx, ey], end];
        else path = [start, [ex, sy], end];
    } else {
        if (srcId && cells.has(srcId)) path = [start, [sx, ey], end];
        else path = [start, [ex, sy], end];
    }
    return { path, style };
}

function edgeXml(cell, z, name, cells) {
    const data = edgePoints(cell, cells);
    if (!data) return null;
    const { path, style } = data;
    
    const xs = path.map(p => p[0]);
    const ys = path.map(p => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const maxx = Math.max(...xs), maxy = Math.max(...ys);
    const W = Math.max(1, Math.round((maxx - minx) * EMU));
    const H = Math.max(1, Math.round((maxy - miny) * EMU));
    
    const pathCmd = [];
    for (let i = 0; i < path.length; i++) {
        const [px, py] = path[i];
        const rx = Math.round((px - minx) * EMU);
        const ry = Math.round((py - miny) * EMU);
        if (i === 0) {
            pathCmd.push(`<a:moveTo><a:pt x="${rx}" y="${ry}"/></a:moveTo>`);
        } else {
            pathCmd.push(`<a:lnTo><a:pt x="${rx}" y="${ry}"/></a:lnTo>`);
        }
    }
    
    const stroke = color6(style['strokeColor'], '000000');
    const swpx = parseFloat(style['strokeWidth'] || '1') || 1.0;
    const endArrow = style['endArrow'];
    let tail = `<a:tailEnd type="none"/>`;
    if (endArrow && endArrow !== 'none') {
        tail = `<a:tailEnd type="triangle" w="med" len="med"/>`;
    }
    const head = `<a:headEnd type="none"/>`;
    
    const spPr = (
        `<wps:spPr>` +
        `<a:xfrm><a:off x="${Math.round(minx * EMU)}" y="${Math.round(miny * EMU)}"/>` +
        `<a:ext cx="${W}" cy="${H}"/></a:xfrm>` +
        `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>` +
        `<a:rect l="0" t="0" r="${W}" b="${H}"/>` +
        `<a:pathLst><a:path w="${W}" h="${H}">${pathCmd.join('')}</a:path></a:pathLst>` +
        `</a:custGeom>` +
        `<a:noFill/>` +
        `<a:ln w="${Math.round(swpx * 12700)}" cap="flat" cmpd="sng" algn="ctr">` +
        `<a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill>${head}${tail}</a:ln>` +
        `</wps:spPr>`
    );
    
    return anchorWrap(z, name, minx, miny, maxx - minx, maxy - miny, shapeXml(spPr), 0);
}

function paragraphXml(drawingXml) {
    return (
        `<w:p><w:pPr><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>` +
        `<w:r>${drawingXml}</w:r></w:p>`
    );
}

function buildDocument(body) {
    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<w:document ` +
        `xmlns:w="${W_NS}" xmlns:wp="${WP_NS}" xmlns:a="${A_NS}" ` +
        `xmlns:wps="${WPS_NS}" xmlns:mc="${MC_NS}" xmlns:r="${R_NS}">` +
        `<w:body>` +
        body +
        `<w:sectPr>` +
        `<w:pgSz w:w="11906" w:h="16838"/>` +
        `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>` +
        `<w:cols w:space="708"/>` +
        `<w:docGrid w:linePitch="360"/>` +
        `</w:sectPr>` +
        `</w:body></w:document>`
    );
}

const xmlText = `<mxfile host="app.diagrams.net" modified="2026-07-18T00:00:00.000Z" agent="GeminiConverter" version="24.7.17" type="device">
  <diagram id="unique_diagram_id" name="Page-1">
    <mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        
        <!-- Shape Elements -->
        <!-- Node 1: Top Header Box -->
        <mxCell id="node_1" value="Select “NO” in the “Attended” icon in the CMS IUCH patient list screen of the relevant sub- specialty" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="60" y="20" width="730" height="50" as="geometry" />
        </mxCell>
        
        <!-- Node 2: No unattended patients Label -->
        <mxCell id="node_2" value="No unattended patients" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="110" y="100" width="240" height="35" as="geometry" />
        </mxCell>

        <!-- Node 3: Have unattended patients Label -->
        <mxCell id="node_3" value="Have unattended patients" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="410" y="100" width="240" height="35" as="geometry" />
        </mxCell>

        <!-- Node 4: Fill in the NO DNA sheet -->
        <mxCell id="node_4" value="Fill in the “NO DNA sheet” put in the rack on the consultation room desk" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="85" y="160" width="290" height="100" as="geometry" />
        </mxCell>

        <!-- Node 5: Doctor should check every case -->
        <mxCell id="node_5" value="Doctor should check every case in CMS if any planned call-back request previously" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="435" y="160" width="240" height="100" as="geometry" />
        </mxCell>

        <!-- Node 6: No need to call back Decision -->
        <mxCell id="node_6" value="No need to call back" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="340" y="290" width="190" height="50" as="geometry" />
        </mxCell>

        <!-- Node 7: Need to call back Decision -->
        <mxCell id="node_7" value="Need to call back" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="580" y="290" width="190" height="50" as="geometry" />
        </mxCell>

        <!-- Node 8: Multi-line instruction block (Left) -->
        <mxCell id="node_8" value="(1)Put a “X” over the Chinese/ English name&lt;br&gt;&lt;hr style=&quot;border-top: 1px solid #0B4C5F; margin: 5px 0;&quot;&gt;(2)For the 2&amp;lt;sup&amp;gt;nd&amp;lt;/sup&amp;gt; attempt DNA patient:&lt;br&gt;Write late entry by Dr XXX on dd/ mm/ yy&lt;br&gt;Patient default XX times call back appointment (the abnormal result)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=13;align=center;" vertex="1" parent="1">
          <mxGeometry x="325" y="370" width="220" height="210" as="geometry" />
        </mxCell>

        <!-- Node 9: Write call within XX -->
        <mxCell id="node_9" value="Write “call within XX” next to patient name for both 1&amp;lt;sup&amp;gt;st&amp;lt;/sup&amp;gt; &amp;amp;amp; 2&amp;lt;sup&amp;gt;nd&amp;lt;/sup&amp;gt; attempt patients" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="600" y="370" width="190" height="85" as="geometry" />
        </mxCell>

        <!-- Node 10: Multi-line instruction block (Right) -->
        <mxCell id="node_10" value="(1)For 1&amp;lt;sup&amp;gt;st&amp;lt;/sup&amp;gt; attempt DNA case:&lt;br&gt;Enter into patient’s last CMS notes for call back reason + time frame&lt;br&gt;&lt;br&gt;(2)For 2&amp;lt;sup&amp;gt;nd&amp;lt;/sup&amp;gt; attempt DNA case:&lt;br&gt;Should indicate the number of defaulting call back appointment" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=13;align=center;" vertex="1" parent="1">
          <mxGeometry x="560" y="480" width="270" height="150" as="geometry" />
        </mxCell>

        <!-- Node 11: Sign and Stamp -->
        <mxCell id="node_11" value="Sign and Stamp on the DNA list for verification" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="365" y="660" width="340" height="40" as="geometry" />
        </mxCell>

        <!-- Node 12: Put back the DNA list -->
        <mxCell id="node_12" value="Put back the DNA list into the “DNA” list folder and place back to “out-tray”" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="335" y="730" width="400" height="55" as="geometry" />
        </mxCell>

        <!-- Node 13: Clerical staff timeframe -->
        <mxCell id="node_13" value="Clerical staff should keep for 1 year" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#0B4C5F;strokeWidth=2;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="335" y="820" width="400" height="55" as="geometry" />
        </mxCell>

        <!-- Connector Elements (Edges) -->
        <!-- Top Split Line Spine (Left Component) -->
        <mxCell id="edge_1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_1" target="node_2">
          <mxGeometry relative="1" as="geometry">
            <Array points="425,85" />
          </mxGeometry>
        </mxCell>
        
        <!-- Top Split Line Spine (Right Component) -->
        <mxCell id="edge_2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_1" target="node_3">
          <mxGeometry relative="1" as="geometry">
            <Array points="425,85" />
          </mxGeometry>
        </mxCell>

        <mxCell id="edge_3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_2" target="node_4">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="edge_4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_3" target="node_5">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Split Spine below Doctor Box (Left branch) -->
        <mxCell id="edge_5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_5" target="node_6">
          <mxGeometry relative="1" as="geometry">
            <Array points="555,275" />
          </mxGeometry>
        </mxCell>

        <!-- Split Spine below Doctor Box (Right branch) -->
        <mxCell id="edge_6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_5" target="node_7">
          <mxGeometry relative="1" as="geometry">
            <Array points="555,275" />
          </mxGeometry>
        </mxCell>

        <mxCell id="edge_7" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_6" target="node_8">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="edge_8" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_7" target="node_9">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="edge_9" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_9" target="node_10">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Alignment flow towards verification step -->
        <mxCell id="edge_10" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_4" target="node_11">
          <mxGeometry relative="1" as="geometry">
            <Array points="230,645" />
          </mxGeometry>
        </mxCell>

        <mxCell id="edge_11" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_8" target="node_11">
          <mxGeometry relative="1" as="geometry">
            <Array points="435,645" />
          </mxGeometry>
        </mxCell>

        <mxCell id="edge_12" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_10" target="node_11">
          <mxGeometry relative="1" as="geometry">
            <Array points="695,645" />
          </mxGeometry>
        </mxCell>

        <!-- Downward Main Sequence -->
        <mxCell id="edge_13" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_11" target="node_12">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="edge_14" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;" edge="1" parent="1" source="node_12" target="node_13">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Loopback path (Left Side): If no need for 2nd call back -->
        <mxCell id="edge_15" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;value=If the call<br>back patient<br>no need for<br>2&lt;sup&gt;nd&lt;/sup&gt; call back;labelBackgroundColor=#ffffff;fontSize=13;" edge="1" parent="1" source="node_11" target="node_8">
          <mxGeometry relative="1" as="geometry">
            <Array points="265,680" point="265,455" />
          </mxGeometry>
        </mxCell>

        <!-- Loopback path (Right Side): If call back patient DNA again -->
        <mxCell id="edge_16" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;strokeColor=#0B4C5F;strokeWidth=1.5;value=If the call<br>back patient<br>DNA again;labelBackgroundColor=#ffffff;fontSize=13;" edge="1" parent="1" source="node_11" target="node_5">
          <mxGeometry relative="1" as="geometry">
            <Array points="870,680" point="870,200" />
          </mxGeometry>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
const mxCells = Array.from(doc.querySelectorAll('mxCell'));
const cellsMap = new Map();

for (const c of mxCells) {
    const id = c.getAttribute('id');
    if (id) cellsMap.set(id, c);
}

const vertices = mxCells.filter(c => c.getAttribute('vertex') === '1' && c.querySelector('mxGeometry'));
const edges = mxCells.filter(c => c.getAttribute('edge') === '1');

let z = 0;
const paras = [];

for (const e of edges) {
    z++;
    const d = edgeXml(e, z, `Connector ${z}`, cellsMap);
    if (d) {
        paras.push(paragraphXml(d));
    } else {
        console.log(`Failed to process edge ${e.getAttribute('id')}`);
    }
}

for (const v of vertices) {
    z++;
    const value = v.getAttribute('value') || '';
    const d = vertexXml(v, z, `Shape ${z}`);
    if (d) {
        paras.push(paragraphXml(d));
    } else {
        console.log(`Failed to process vertex ${v.getAttribute('id')}`);
    }
}

const documentXml = buildDocument(paras.join(''));
fs.writeFileSync('output.xml', documentXml);
console.log(`Done processing. output.xml length: ${documentXml.length}, paras: ${paras.length}`);
