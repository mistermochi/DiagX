import JSZip from 'jszip';
import * as fflate from 'fflate';

function parseXmlDoc(xmlStr: string): Document {
    if (typeof DOMParser !== 'undefined') {
        return new DOMParser().parseFromString(xmlStr, 'text/xml');
    }
    throw new Error('No XML parser available in this environment');
}

const EMU = 9525; // px -> EMU at 96 dpi

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function esc(s: string) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

export function decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/gi, '\u00A0')
        .replace(/&ensp;/gi, '\u2002')
        .replace(/&emsp;/gi, '\u2003')
        .replace(/&thinsp;/gi, '\u2009')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parseStyle(s: string): Record<string, string> {
    const out: Record<string, string> = {};
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

export function geomOf(cell: Element, cellsMap?: Map<string, Element>): [number, number, number, number] | null {
    const g = cell.querySelector('mxGeometry');
    if (!g) return null;
    let x = parseFloat(g.getAttribute('x') || '0');
    let y = parseFloat(g.getAttribute('y') || '0');
    const w = parseFloat(g.getAttribute('width') || '0');
    const h = parseFloat(g.getAttribute('height') || '0');

    if (cellsMap) {
        let parentId = cell.getAttribute('parent');
        while (parentId && parentId !== '0' && parentId !== '1') {
            const parent = cellsMap.get(parentId);
            if (!parent) break;
            const pg = parent.querySelector('mxGeometry');
            if (pg) {
                x += parseFloat(pg.getAttribute('x') || '0');
                y += parseFloat(pg.getAttribute('y') || '0');
            }
            parentId = parent.getAttribute('parent');
        }
    }

    return [x, y, w, h];
}

export function anchorOf(cell: Element, ex?: string | null, ey?: string | null, cellsMap?: Map<string, Element>) {
    const geom = geomOf(cell, cellsMap);
    if (!geom) return null;
    const [x, y, w, h] = geom;
    if (ex != null && ey != null && !isNaN(parseFloat(ex)) && !isNaN(parseFloat(ey))) {
        return { pt: [x + parseFloat(ex) * w, y + parseFloat(ey) * h], geom, explicit: true };
    }
    return { pt: [x + 0.5 * w, y + 0.5 * h], geom, explicit: false };
}

export function color6(v: string | null | undefined, def = '000000'): string {
    if (!v || v === 'none') return def;
    v = v.replace(/^#/, '');
    if (v.length === 6) return v.toUpperCase();
    if (v.length === 3) return v.split('').map(c => c + c).join('').toUpperCase();
    return def;
}

export function parsePointsString(str: string): number[][] {
    const pts: number[][] = [];
    if (!str) return pts;
    const tokens = str.trim().split(/[\s;]+/);
    for (const tok of tokens) {
        if (!tok) continue;
        const coords = tok.split(',').map(n => parseFloat(n));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            pts.push(coords);
        } else if (coords.length > 2 && coords.length % 2 === 0) {
            for (let i = 0; i < coords.length; i += 2) {
                if (!isNaN(coords[i]) && !isNaN(coords[i+1])) {
                    pts.push([coords[i], coords[i+1]]);
                }
            }
        }
    }
    return pts;
}

export function getGeometryPoints(g: Element) {
    let sourcePoint: number[] | null = null;
    let targetPoint: number[] | null = null;
    const waypoints: number[][] = [];

    for (const ch of Array.from(g.children)) {
        if (ch.tagName === 'mxPoint') {
            const asAttr = ch.getAttribute('as');
            const xAttr = ch.getAttribute('x');
            const yAttr = ch.getAttribute('y');
            if (xAttr !== null && yAttr !== null) {
                const x = parseFloat(xAttr);
                const y = parseFloat(yAttr);
                if (asAttr === 'sourcePoint') {
                    sourcePoint = [x, y];
                } else if (asAttr === 'targetPoint') {
                    targetPoint = [x, y];
                } else {
                    waypoints.push([x, y]);
                }
            }
        } else if (ch.tagName === 'Array') {
            const mxPts = Array.from(ch.querySelectorAll('mxPoint'));
            if (mxPts.length > 0) {
                for (const p of mxPts) {
                    const asAttr = p.getAttribute('as');
                    const xAttr = p.getAttribute('x');
                    const yAttr = p.getAttribute('y');
                    if (xAttr !== null && yAttr !== null) {
                        const x = parseFloat(xAttr);
                        const y = parseFloat(yAttr);
                        if (asAttr === 'sourcePoint') {
                            sourcePoint = [x, y];
                        } else if (asAttr === 'targetPoint') {
                            targetPoint = [x, y];
                        } else if (asAttr !== 'sourcePoint' && asAttr !== 'targetPoint') {
                            waypoints.push([x, y]);
                        }
                    }
                }
            }
            const ptsAttr = ch.getAttribute('points');
            if (ptsAttr) waypoints.push(...parsePointsString(ptsAttr));
            const ptAttr = ch.getAttribute('point');
            if (ptAttr) waypoints.push(...parsePointsString(ptAttr));
        }
    }
    const geomPts = g.getAttribute('points');
    if (geomPts) waypoints.push(...parsePointsString(geomPts));
    return { sourcePoint, targetPoint, waypoints };
}

export function getWaypoints(g: Element): number[][] {
    return getGeometryPoints(g).waypoints;
}

const TAG_RE = /(<\/?(?:b|strong|i|em|u|sup|sub)(?:\s*\/?>))/i;
const DIV_OPEN = /<div\b([^>]*)>/i;
const DIV_CLOSE = /<\/div\s*>/i;
const P_OPEN = /<p\b([^>]*)>/i;
const P_CLOSE = /<\/p\s*>/i;
const UL_OPEN = /<ul\b([^>]*)>/i;
const UL_CLOSE = /<\/ul\s*>/i;
const OL_OPEN = /<ol\b([^>]*)>/i;
const OL_CLOSE = /<\/ol\s*>/i;
const LI_OPEN = /<li\b([^>]*)>/i;
const LI_CLOSE = /<\/li\s*>/i;
const BR_RE = /<br\s*\/?>/i;
const HR_RE = /<hr\b[^>]*\/?>/i;

export function parseRuns(raw: string) {
    const runs = [];
    let bold = false;
    let italic = false;
    let underline = false;
    let sup = false;
    let sub = false;
    const parts = raw.split(TAG_RE);
    for (const part of parts) {
        if (!part) continue;
        const pl = part.toLowerCase().trim();
        if (pl === '<b>' || pl === '<strong>') bold = true;
        else if (pl === '</b>' || pl === '</strong>') bold = false;
        else if (pl === '<i>' || pl === '<em>') italic = true;
        else if (pl === '</i>' || pl === '</em>') italic = false;
        else if (pl === '<u>') underline = true;
        else if (pl === '</u>') underline = false;
        else if (pl === '<sup>') sup = true;
        else if (pl === '</sup>') sup = false;
        else if (pl === '<sub>') sub = true;
        else if (pl === '</sub>') sub = false;
        else {
            const cleanText = decodeHtmlEntities(part.replace(/<[^>]*>/g, ''));
            if (cleanText) {
                runs.push({ text: cleanText, bold, italic, underline, sup, sub });
            }
        }
    }
    return runs;
}

export function parseValue(value: string) {
    const lines: Array<[string | null, any[], boolean]> = [];
    const stack: (string | null)[] = [];
    const listStack: Array<{ type: 'ul' | 'ol', index: number }> = [];
    let buf: string[] = [];

    const flush = () => {
        if (buf.length > 0) {
            const line = buf.join('');
            const subs = line.split(BR_RE);
            for (let sub of subs) {
                sub = sub.trim();
                if (sub) {
                    if (HR_RE.test(sub)) {
                        lines.push([null, [], true]);
                    } else {
                        const align = stack.length > 0 ? stack[stack.length - 1] : null;
                        lines.push([align, parseRuns(sub), false]);
                    }
                }
            }
            buf = [];
        }
    };

    let i = 0;
    while (i < value.length) {
        let match = value.substring(i).match(DIV_OPEN) || value.substring(i).match(P_OPEN);
        if (match && match.index === 0) {
            flush();
            const st = (match[1] || '').replace(/\s/g, '');
            let align = null;
            if (st.includes('text-align:center') || st.includes('align="center"')) align = 'center';
            else if (st.includes('text-align:right') || st.includes('align="right"')) align = 'right';
            else if (st.includes('text-align:left') || st.includes('align="left"')) align = 'left';
            stack.push(align);
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(DIV_CLOSE) || value.substring(i).match(P_CLOSE);
        if (match && match.index === 0) {
            flush();
            if (stack.length > 0) stack.pop();
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(UL_OPEN);
        if (match && match.index === 0) {
            flush();
            listStack.push({ type: 'ul', index: 1 });
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(OL_OPEN);
        if (match && match.index === 0) {
            flush();
            listStack.push({ type: 'ol', index: 1 });
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(UL_CLOSE) || value.substring(i).match(OL_CLOSE);
        if (match && match.index === 0) {
            flush();
            if (listStack.length > 0) listStack.pop();
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(LI_OPEN);
        if (match && match.index === 0) {
            flush();
            if (listStack.length > 0 && listStack[listStack.length - 1].type === 'ol') {
                const item = listStack[listStack.length - 1];
                buf.push(`${item.index++}. `);
            } else {
                buf.push('• ');
            }
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(LI_CLOSE);
        if (match && match.index === 0) {
            flush();
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(BR_RE);
        if (match && match.index === 0) {
            flush();
            i += match[0].length;
            continue;
        }
        match = value.substring(i).match(HR_RE);
        if (match && match.index === 0) {
            flush();
            lines.push([null, [], true]);
            i += match[0].length;
            continue;
        }
        buf.push(value[i]);
        i++;
    }
    flush();
    return lines;
}

export function textParagraphs(lines: Array<[string | null, any[], boolean]>, fontSize: number, halfW: number, defaultAlign = 'center') {
    const out = [];
    for (const [align, runs, isHr] of lines) {
        if (isHr) {
            out.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="0B4C5F"/></w:pBdr></w:pPr></w:p>`);
            continue;
        }
        let ppr = '<w:pPr>';
        const effAlign = align || defaultAlign;
        if (effAlign === 'center') {
            ppr += '<w:jc w:val="center"/>';
        } else if (effAlign === 'right') {
            ppr += '<w:jc w:val="right"/>';
        } else if (effAlign === 'left') {
            ppr += '<w:jc w:val="left"/>';
        }
        ppr += '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>';
        const bits = [];
        for (const { text, bold, italic, underline, sup, sub } of runs) {
            let rpr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="SimSun" w:cs="Arial"/>`;
            if (bold) rpr += '<w:b/>';
            if (italic) rpr += '<w:i/>';
            if (underline) rpr += '<w:u w:val="single"/>';
            if (sup) rpr += '<w:vertAlign w:val="superscript"/>';
            else if (sub) rpr += '<w:vertAlign w:val="subscript"/>';
            rpr += `<w:sz w:val="${halfW}"/><w:szCs w:val="${halfW}"/><w:color w:val="000000"/></w:rPr>`;
            bits.push(`<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`);
        }
        out.push(bits.length ? `<w:p>${ppr}${bits.join('')}</w:p>` : `<w:p>${ppr}</w:p>`);
    }
    return out.length ? out.join('') : '<w:p/>';
}

export function shapeXml(wspInner: string, z: number, name: string) {
    return (
        `<wps:wsp>` +
        `<wps:cNvPr id="${z}" name="${esc(name.substring(0, 80))}"/>` +
        `<wps:cNvSpPr/>` +
        `${wspInner}` +
        `</wps:wsp>`
    );
}

export function vertexWsp(cell: Element, z: number, name: string, cellsMap?: Map<string, Element>, minX = 0, minY = 0) {
    const style = parseStyle(cell.getAttribute('style') || '');
    const g = geomOf(cell, cellsMap);
    if (!g) return null;
    const [x, y, w, h] = g;
    const value = cell.getAttribute('value') || '';

    const isGroup = style['group'] === '1' || style['group'] === 'true' || (cell.getAttribute('style') || '').includes('group');
    const isText = style['text'] === '1' || style['shape'] === 'text' || style['label'] === '1' || style['shape'] === 'label';
    const noFill = style['fillColor'] === 'none' || (isGroup && !style['fillColor']) || (isText && !style['fillColor']);
    const noStroke = style['strokeColor'] === 'none' || (isGroup && !style['strokeColor']) || (isText && !style['strokeColor']);

    const lines = value ? parseValue(value) : [];

    if (lines.length === 0 && noFill && noStroke) {
        return null;
    }

    const fill = color6(style['fillColor'], 'ffffff');
    const stroke = color6(style['strokeColor'], '000000');
    const sw = parseFloat(style['strokeWidth'] || '1') || 1.0;
    const fsRaw = parseFloat(style['fontSize'] || '12') || 12.0;
    const fs = fsRaw * 0.75;
    const halfW = Math.max(2, Math.round(fs * 2));
    const rounded = style['rounded'] === '1';
    
    let valign = 'ctr';
    if (style['verticalAlign'] === 'top') valign = 't';
    else if (style['verticalAlign'] === 'bottom') valign = 'b';
    
    const align = style['align'] || 'center';

    const spLeft = style['spacingLeft'] ? parseFloat(style['spacingLeft']) : 7;
    const spRight = style['spacingRight'] ? parseFloat(style['spacingRight']) : 7;
    const spTop = style['spacingTop'] ? parseFloat(style['spacingTop']) : 4;
    const spBottom = style['spacingBottom'] ? parseFloat(style['spacingBottom']) : 4;

    const lIns = Math.round(spLeft * EMU);
    const rIns = Math.round(spRight * EMU);
    const tIns = Math.round(spTop * EMU);
    const bIns = Math.round(spBottom * EMU);

    const prst = rounded ? 'roundRect' : 'rect';

    let fillXml = `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`;
    if (noFill) fillXml = `<a:noFill/>`;

    let strokeXml = `<a:ln w="${Math.round(sw * 12700)}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln>`;
    if (noStroke) strokeXml = `<a:ln><a:noFill/></a:ln>`;

    const relX = Math.round((x - minX) * EMU);
    const relY = Math.round((y - minY) * EMU);

    const spPr = (
        `<wps:spPr>` +
        `<a:xfrm><a:off x="${relX}" y="${relY}"/><a:ext cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/></a:xfrm>` +
        `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>` +
        `${fillXml}${strokeXml}` +
        `</wps:spPr>`
    );

    let txbx = '';
    if (lines.length > 0) {
        txbx = `<wps:txbx><w:txbxContent>${textParagraphs(lines, fs, halfW, align)}</w:txbxContent></wps:txbx>`;
    }
    const bodypr = `<wps:bodyPr wrap="square" lIns="${lIns}" tIns="${tIns}" rIns="${rIns}" bIns="${bIns}" anchor="${valign}" vert="horz"/>`;
    return shapeXml(spPr + txbx + bodypr, z, name);
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(v, max));
}

function intersectRect(pFrom: number[], pTo: number[], rect: number[]): number[] {
    const [p1x, p1y] = pFrom;
    const [p2x, p2y] = pTo;
    const [rx, ry, rw, rh] = rect;
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return [p2x, p2y];

    let bestT = 1.0;
    let found = false;

    if (Math.abs(dy) > 1e-6) {
        const t = (ry - p1y) / dy;
        if (t >= 0 && t <= bestT) {
            const x = p1x + t * dx;
            if (x >= rx - 1e-3 && x <= rx + rw + 1e-3) {
                bestT = t;
                found = true;
            }
        }
    }
    if (Math.abs(dy) > 1e-6) {
        const t = (ry + rh - p1y) / dy;
        if (t >= 0 && t <= bestT) {
            const x = p1x + t * dx;
            if (x >= rx - 1e-3 && x <= rx + rw + 1e-3) {
                bestT = t;
                found = true;
            }
        }
    }
    if (Math.abs(dx) > 1e-6) {
        const t = (rx - p1x) / dx;
        if (t >= 0 && t <= bestT) {
            const y = p1y + t * dy;
            if (y >= ry - 1e-3 && y <= ry + rh + 1e-3) {
                bestT = t;
                found = true;
            }
        }
    }
    if (Math.abs(dx) > 1e-6) {
        const t = (rx + rw - p1x) / dx;
        if (t >= 0 && t <= bestT) {
            const y = p1y + t * dy;
            if (y >= ry - 1e-3 && y <= ry + rh + 1e-3) {
                bestT = t;
                found = true;
            }
        }
    }

    if (found) {
        return [p1x + bestT * dx, p1y + bestT * dy];
    }
    return [p2x, p2y];
}

export function edgePoints(cell: Element, cells: Map<string, Element>) {
    const style = parseStyle(cell.getAttribute('style') || '');
    const srcId = cell.getAttribute('source');
    const tgtId = cell.getAttribute('target');
    const g = cell.querySelector('mxGeometry');

    if (!g) return null;

    const { sourcePoint, targetPoint, waypoints } = getGeometryPoints(g);

    let edgeParentX = 0;
    let edgeParentY = 0;
    let edgeParentId = cell.getAttribute('parent');
    while (edgeParentId && edgeParentId !== '0' && edgeParentId !== '1') {
        const parent = cells.get(edgeParentId);
        if (!parent) break;
        const pg = parent.querySelector('mxGeometry');
        if (pg) {
            edgeParentX += parseFloat(pg.getAttribute('x') || '0');
            edgeParentY += parseFloat(pg.getAttribute('y') || '0');
        }
        edgeParentId = parent.getAttribute('parent');
    }

    if (edgeParentX !== 0 || edgeParentY !== 0) {
        if (sourcePoint) { sourcePoint[0] += edgeParentX; sourcePoint[1] += edgeParentY; }
        if (targetPoint) { targetPoint[0] += edgeParentX; targetPoint[1] += edgeParentY; }
        for (const wp of waypoints) {
            wp[0] += edgeParentX;
            wp[1] += edgeParentY;
        }
    }

    let srcGeom: [number, number, number, number] | null = null;
    let srcIsVertex = false;
    if (srcId && cells.has(srcId)) {
        srcGeom = geomOf(cells.get(srcId)!, cells);
        if (srcGeom) srcIsVertex = true;
    }
    if (!srcGeom && sourcePoint) {
        srcGeom = [sourcePoint[0], sourcePoint[1], 0, 0];
        srcIsVertex = false;
    }
    if (!srcGeom) return null;

    let tgtGeom: [number, number, number, number] | null = null;
    let tgtIsVertex = false;
    if (tgtId && cells.has(tgtId)) {
        tgtGeom = geomOf(cells.get(tgtId)!, cells);
        if (tgtGeom) tgtIsVertex = true;
    }
    if (!tgtGeom && targetPoint) {
        tgtGeom = [targetPoint[0], targetPoint[1], 0, 0];
        tgtIsVertex = false;
    }
    if (!tgtGeom) return null;

    const [sx, sy, sw, sh] = srcGeom;
    const [tx, ty, tw, th] = tgtGeom;
    const scx = sx + 0.5 * sw, scy = sy + 0.5 * sh;
    const tcx = tx + 0.5 * tw, tcy = ty + 0.5 * th;

    const exitX = style['exitX'] != null ? parseFloat(style['exitX']) : null;
    const exitY = style['exitY'] != null ? parseFloat(style['exitY']) : null;
    const entryX = style['entryX'] != null ? parseFloat(style['entryX']) : null;
    const entryY = style['entryY'] != null ? parseFloat(style['entryY']) : null;

    const isOrtho = style['edgeStyle'] === 'orthogonalEdgeStyle' || style['edgeStyle'] === 'elbowEdgeStyle' || style['orthogonal'] === '1';

    let path: number[][] = [];

    if (isOrtho) {
        let vert = false;
        if (exitY != null && (exitY === 0 || exitY === 1)) vert = true;
        else if (exitX != null && (exitX === 0 || exitX === 1)) vert = false;
        else if (entryY != null && (entryY === 0 || entryY === 1)) vert = true;
        else if (entryX != null && (entryX === 0 || entryX === 1)) vert = false;
        else {
            const distY = Math.abs(scy - tcy) - (sh + th) / 2;
            const distX = Math.abs(scx - tcx) - (sw + tw) / 2;
            if (Math.abs(scx - tcx) < 1e-4) vert = true;
            else if (distX < 0) vert = true;
            else if (distY < 0) vert = false;
            else vert = distY <= distX;
        }

        if (waypoints.length > 0) {
            const firstWp = waypoints[0];
            const lastWp = waypoints[waypoints.length - 1];

            let startPt: number[];
            let startDir: 'vert' | 'horz' = 'vert';

            if (!srcIsVertex) {
                startPt = [sx, sy];
                startDir = Math.abs(firstWp[0] - sx) < Math.abs(firstWp[1] - sy) ? 'vert' : 'horz';
            } else if (exitX != null && exitY != null) {
                startPt = [sx + exitX * sw, sy + exitY * sh];
                startDir = (exitY === 0 || exitY === 1) ? 'vert' : 'horz';
            } else {
                if (firstWp[1] >= sy + sh) {
                    startPt = [clamp(firstWp[0], sx, sx + sw), sy + sh];
                    startDir = 'vert';
                } else if (firstWp[1] <= sy) {
                    startPt = [clamp(firstWp[0], sx, sx + sw), sy];
                    startDir = 'vert';
                } else if (firstWp[0] >= sx + sw) {
                    startPt = [sx + sw, clamp(firstWp[1], sy, sy + sh)];
                    startDir = 'horz';
                } else {
                    startPt = [sx, clamp(firstWp[1], sy, sy + sh)];
                    startDir = 'horz';
                }
            }

            let endPt: number[];
            let endDir: 'vert' | 'horz' = 'vert';

            if (!tgtIsVertex) {
                endPt = [tx, ty];
                endDir = Math.abs(lastWp[0] - tx) < Math.abs(lastWp[1] - ty) ? 'vert' : 'horz';
            } else if (entryX != null && entryY != null) {
                endPt = [tx + entryX * tw, ty + entryY * th];
                endDir = (entryY === 0 || entryY === 1) ? 'vert' : 'horz';
            } else {
                if (lastWp[1] >= ty + th) {
                    endPt = [clamp(lastWp[0], tx, tx + tw), ty + th];
                    endDir = 'vert';
                } else if (lastWp[1] <= ty) {
                    endPt = [clamp(lastWp[0], tx, tx + tw), ty];
                    endDir = 'vert';
                } else if (lastWp[0] >= tx + tw) {
                    endPt = [tx + tw, clamp(lastWp[1], ty, ty + th)];
                    endDir = 'horz';
                } else {
                    endPt = [tx, clamp(lastWp[1], ty, ty + th)];
                    endDir = 'horz';
                }
            }

            const rawPoints = [startPt, ...waypoints, endPt];
            path = [rawPoints[0]];

            for (let i = 0; i < rawPoints.length - 1; i++) {
                const curr = path[path.length - 1];
                const next = rawPoints[i + 1];

                const dx = Math.abs(curr[0] - next[0]);
                const dy = Math.abs(curr[1] - next[1]);

                if (dx > 1e-4 && dy > 1e-4) {
                    if (i === 0) {
                        if (startDir === 'vert') path.push([curr[0], next[1]]);
                        else path.push([next[0], curr[1]]);
                    } else if (i === rawPoints.length - 2) {
                        if (endDir === 'vert') path.push([next[0], curr[1]]);
                        else path.push([curr[0], next[1]]);
                    } else {
                        path.push([curr[0], next[1]]);
                    }
                }
                path.push(next);
            }
        } else {
            let startPt: number[];
            if (exitX != null && exitY != null) {
                startPt = [sx + exitX * sw, sy + exitY * sh];
            } else if (!srcIsVertex) {
                startPt = [sx, sy];
            } else if (vert) {
                startPt = scy <= tcy ? [scx, sy + sh] : [scx, sy];
            } else {
                startPt = scx <= tcx ? [sx + sw, scy] : [sx, scy];
            }

            let endPt: number[];
            if (entryX != null && entryY != null) {
                endPt = [tx + entryX * tw, ty + entryY * th];
            } else if (!tgtIsVertex) {
                endPt = [tx, ty];
            } else if (vert) {
                endPt = scy <= tcy ? [tcx, ty] : [tcx, ty + th];
            } else {
                endPt = scx <= tcx ? [tx, tcy] : [tx + tw, tcy];
            }

            const isExitVert = exitY != null && (exitY === 0 || exitY === 1);
            const isExitHorz = exitX != null && (exitX === 0 || exitX === 1);
            const isEntryVert = entryY != null && (entryY === 0 || entryY === 1);
            const isEntryHorz = entryX != null && (entryX === 0 || entryX === 1);

            if (Math.abs(startPt[0] - endPt[0]) < 1e-4 || Math.abs(startPt[1] - endPt[1]) < 1e-4) {
                path = [startPt, endPt];
            } else if ((isExitVert || vert) && isEntryHorz) {
                path = [startPt, [startPt[0], endPt[1]], endPt];
            } else if ((isExitHorz || !vert) && isEntryVert) {
                path = [startPt, [endPt[0], startPt[1]], endPt];
            } else if (vert) {
                const midY = (startPt[1] + endPt[1]) / 2;
                path = [startPt, [startPt[0], midY], [endPt[0], midY], endPt];
            } else {
                const midX = (startPt[0] + endPt[0]) / 2;
                path = [startPt, [midX, startPt[1]], [midX, endPt[1]], endPt];
            }
        }
    } else {
        let startPt = [scx, scy];
        let endPt = [tcx, tcy];

        if (!srcIsVertex) startPt = [sx, sy];
        else if (exitX != null && exitY != null) startPt = [sx + exitX * sw, sy + exitY * sh];

        if (!tgtIsVertex) endPt = [tx, ty];
        else if (entryX != null && entryY != null) endPt = [tx + entryX * tw, ty + entryY * th];

        if (srcIsVertex && (exitX == null || exitY == null) && waypoints.length > 0) {
            const firstWp = waypoints[0];
            startPt = intersectRect(firstWp, [scx, scy], [sx, sy, sw, sh]);
        }
        if (tgtIsVertex && (entryX == null || entryY == null) && waypoints.length > 0) {
            const lastWp = waypoints[waypoints.length - 1];
            endPt = intersectRect(lastWp, [tcx, tcy], [tx, ty, tw, th]);
        }
        if (srcIsVertex && (exitX == null || exitY == null) && waypoints.length === 0) {
            startPt = intersectRect(endPt, [scx, scy], [sx, sy, sw, sh]);
        }
        if (tgtIsVertex && (entryX == null || entryY == null) && waypoints.length === 0) {
            endPt = intersectRect(startPt, [tcx, tcy], [tx, ty, tw, th]);
            if (srcIsVertex && (exitX == null || exitY == null)) {
                startPt = intersectRect(endPt, [scx, scy], [sx, sy, sw, sh]);
            }
        }

        path = [startPt, ...waypoints, endPt];
    }

    const cleanPath: number[][] = [];
    for (let i = 0; i < path.length; i++) {
        const pt = [path[i][0], path[i][1]];
        if (cleanPath.length === 0) {
            cleanPath.push(pt);
            continue;
        }
        const prev = cleanPath[cleanPath.length - 1];
        if (Math.abs(prev[0] - pt[0]) < 2) pt[0] = prev[0];
        if (Math.abs(prev[1] - pt[1]) < 2) pt[1] = prev[1];

        if (Math.abs(prev[0] - pt[0]) < 1e-4 && Math.abs(prev[1] - pt[1]) < 1e-4) {
            continue;
        }
        if (cleanPath.length >= 2) {
            const prevPrev = cleanPath[cleanPath.length - 2];
            if ((Math.abs(prevPrev[0] - prev[0]) < 1e-4 && Math.abs(prev[0] - pt[0]) < 1e-4) ||
                (Math.abs(prevPrev[1] - prev[1]) < 1e-4 && Math.abs(prev[1] - pt[1]) < 1e-4)) {
                cleanPath.pop();
            }
        }
        cleanPath.push(pt);
    }

    return { path: cleanPath, style };
}

export function edgeWsp(cell: Element, z: number, name: string, cells: Map<string, Element>, minX = 0, minY = 0) {
    const data = edgePoints(cell, cells);
    if (!data) return null;
    const { path, style } = data;
    if (path.length < 2) return null;
    
    const xs = path.map(p => p[0]);
    const ys = path.map(p => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const maxx = Math.max(...xs), maxy = Math.max(...ys);

    const boundX = minx - minX;
    const boundY = miny - minY;
    const boundW = maxx - minx;
    const boundH = maxy - miny;

    const p0 = path[0];
    const pn = path[path.length - 1];

    const isStraight = path.length <= 2;
    const isRightAngle = path.length === 3;
    const prst = isStraight ? 'straightConnector1' : (isRightAngle ? 'bentConnector2' : 'bentConnector3');

    let rot = 0;
    let isFirstVert = false;
    if (!isStraight) {
        const p1 = path[1];
        isFirstVert = Math.abs(p1[1] - p0[1]) > Math.abs(p1[0] - p0[0]);
        if (isFirstVert) {
            rot = 5400000;
        }
    }

    let flipH = false;
    let flipV = false;

    let cx = 0;
    let cy = 0;
    let posX = 0;
    let posY = 0;

    if (isFirstVert) {
        cx = Math.max(0, Math.round(boundH * EMU));
        cy = Math.max(0, Math.round(boundW * EMU));
        posX = Math.round(boundX * EMU + (cy - cx) / 2);
        posY = Math.round(boundY * EMU + (cx - cy) / 2);
        flipH = p0[1] > pn[1];
        flipV = p0[0] < pn[0];
    } else {
        cx = Math.max(0, Math.round(boundW * EMU));
        cy = Math.max(0, Math.round(boundH * EMU));
        posX = Math.round(boundX * EMU);
        posY = Math.round(boundY * EMU);
        flipH = p0[0] > pn[0];
        flipV = p0[1] > pn[1];
    }

    const rotAttr = rot ? ` rot="${rot}"` : '';
    const flipHAttr = flipH ? ` flipH="1"` : '';
    const flipVAttr = flipV ? ` flipV="1"` : '';

    const stroke = color6(style['strokeColor'], '000000');
    const swpx = parseFloat(style['strokeWidth'] || '1') || 1.0;
    const swEmu = Math.round(swpx * 12700);
    
    const endArrow = style['endArrow'];
    const startArrow = style['startArrow'];

    let tail = (endArrow === 'none' || endArrow === '0') ? `<a:tailEnd type="none"/>` : `<a:tailEnd type="triangle"/>`;
    let head = (startArrow && startArrow !== 'none' && startArrow !== '0') ? `<a:headEnd type="triangle"/>` : `<a:headEnd type="none"/>`;

    const isDashed = style['dashed'] === '1' || style['dashed'] === 'true' || style['dashed'] === '2';
    const dashPattern = style['dashPattern'] || '';
    let dashXml = '';
    if (isDashed) {
        if (dashPattern.startsWith('1 ') || dashPattern.startsWith('2 ') || style['fixDash'] === '1') {
            dashXml = `<a:prstDash val="dot"/>`;
        } else {
            dashXml = `<a:prstDash val="dash"/>`;
        }
    }

    return (
        `<wps:wsp>` +
        `<wps:cNvCnPr/>` +
        `<wps:spPr>` +
        `<a:xfrm${rotAttr}${flipHAttr}${flipVAttr}><a:off x="${posX}" y="${posY}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>` +
        `<a:noFill/>` +
        `<a:ln w="${swEmu}" cap="flat" cmpd="sng" algn="ctr">` +
        `<a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill>${dashXml}${head}${tail}` +
        `</a:ln>` +
        `</wps:spPr>` +
        `<wps:style>` +
        `<a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef>` +
        `<a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef>` +
        `<a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef>` +
        `<a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>` +
        `</wps:style>` +
        `<wps:bodyPr/>` +
        `</wps:wsp>`
    );
}

export function getEdgeLabelBox(cell: Element, cells: Map<string, Element>) {
    const value = cell.getAttribute('value') || '';
    if (!value.trim()) return null;

    const isEdge = cell.getAttribute('edge') === '1';
    const edgeCell = isEdge ? cell : (cells.get(cell.getAttribute('parent') || '') || null);
    if (!edgeCell) return null;

    const data = edgePoints(edgeCell, cells);
    if (!data) return null;
    const { path } = data;
    if (path.length < 2) return null;

    const edgeStyle = parseStyle(edgeCell.getAttribute('style') || '');
    const cellStyle = parseStyle(cell.getAttribute('style') || '');
    const style = { ...edgeStyle, ...cellStyle };

    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i+1][0] - path[i][0];
        const dy = path[i+1][1] - path[i][1];
        const len = Math.sqrt(dx * dx + dy * dy);
        segLens.push(len);
        totalLen += len;
    }

    const g = cell.querySelector('mxGeometry');
    let frac = 0.5;
    let offsetX = 0;
    let offsetY = 0;

    if (g) {
        const xAttr = g.getAttribute('x');
        if (xAttr !== null && !isNaN(parseFloat(xAttr))) {
            const xVal = parseFloat(xAttr);
            if (xVal >= -1 && xVal <= 1) {
                frac = (xVal + 1) / 2;
            } else if (xVal > 1) {
                frac = 1;
            } else if (xVal < -1) {
                frac = 0;
            }
        }

        for (const ch of Array.from(g.children)) {
            if (ch.tagName === 'mxPoint' && ch.getAttribute('as') === 'offset') {
                const ox = parseFloat(ch.getAttribute('x') || '0');
                const oy = parseFloat(ch.getAttribute('y') || '0');
                if (!isNaN(ox)) offsetX = ox;
                if (!isNaN(oy)) offsetY = oy;
            }
        }

        const yAttr = g.getAttribute('y');
        if (yAttr !== null && !isNaN(parseFloat(yAttr))) {
            const yVal = parseFloat(yAttr);
            if (yVal !== 0 && offsetY === 0) {
                offsetY = yVal;
            }
        }
    }

    let targetDist = totalLen * frac;
    let lx = path[0][0], ly = path[0][1];

    for (let i = 0; i < segLens.length; i++) {
        const len = segLens[i];
        if (targetDist <= len) {
            const t = len > 0 ? targetDist / len : 0;
            lx = path[i][0] + t * (path[i+1][0] - path[i][0]);
            ly = path[i][1] + t * (path[i+1][1] - path[i][1]);
            break;
        }
        targetDist -= len;
    }

    lx += offsetX;
    ly += offsetY;

    const lines = parseValue(value);
    if (lines.length === 0) return null;

    const fsRaw = parseFloat(style['fontSize'] || '11') || 11.0;
    let maxChars = 0;
    let isBold = false;
    for (const [, runs, isHr] of lines) {
        if (isHr) continue;
        let lineLen = 0;
        for (const run of runs) {
            lineLen += (run.text || '').length;
            if (run.bold) isBold = true;
        }
        if (lineLen > maxChars) maxChars = lineLen;
    }

    const charFactor = isBold ? 0.58 : 0.53;
    const numLines = lines.length || 1;
    const lw = Math.max(16, Math.round(maxChars * fsRaw * charFactor + 8));
    const lh = Math.max(14, Math.round(numLines * fsRaw * 1.2 + 4));

    const x = lx - lw / 2;
    const y = ly - lh / 2;

    return { x, y, w: lw, h: lh };
}

export function edgeLabelWsp(cell: Element, z: number, name: string, cells: Map<string, Element>, minX = 0, minY = 0) {
    const box = getEdgeLabelBox(cell, cells);
    if (!box) return null;
    const { x, y, w: lw, h: lh } = box;

    const isEdge = cell.getAttribute('edge') === '1';
    const edgeCell = isEdge ? cell : (cells.get(cell.getAttribute('parent') || '') || null);
    if (!edgeCell) return null;

    const edgeStyle = parseStyle(edgeCell.getAttribute('style') || '');
    const cellStyle = parseStyle(cell.getAttribute('style') || '');
    const style = { ...edgeStyle, ...cellStyle };

    const value = cell.getAttribute('value') || '';
    const lines = parseValue(value);
    if (lines.length === 0) return null;

    const fsRaw = parseFloat(style['fontSize'] || '11') || 11.0;
    const fs = fsRaw * 0.75;
    const halfW = Math.max(2, Math.round(fs * 2));

    const fillAttr = style['labelBackgroundColor'];
    const strokeAttr = style['labelBorderColor'];

    const fillXml = (fillAttr && fillAttr !== 'none') 
        ? `<a:solidFill><a:srgbClr val="${color6(fillAttr, 'FFFFFF')}"/></a:solidFill>` 
        : `<a:noFill/>`;

    const strokeXml = (strokeAttr && strokeAttr !== 'none') 
        ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${color6(strokeAttr, '000000')}"/></a:solidFill></a:ln>` 
        : `<a:ln><a:noFill/></a:ln>`;

    const relX = Math.round((x - minX) * EMU);
    const relY = Math.round((y - minY) * EMU);

    const spPr = (
        `<wps:spPr>` +
        `<a:xfrm><a:off x="${relX}" y="${relY}"/><a:ext cx="${Math.round(lw * EMU)}" cy="${Math.round(lh * EMU)}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
        `${fillXml}${strokeXml}` +
        `</wps:spPr>`
    );

    const txbx = `<wps:txbx><w:txbxContent>${textParagraphs(lines, fs, halfW, 'center')}</w:txbxContent></wps:txbx>`;
    const bodypr = `<wps:bodyPr wrap="square" lIns="9144" tIns="4572" rIns="9144" bIns="4572" anchor="ctr" vert="horz"/>`;

    return shapeXml(spPr + txbx + bodypr, z, name);
}

export function buildDocument(body: string) {
    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<w:document ` +
        `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ` +
        `xmlns:mc="${MC_NS}" ` +
        `xmlns:r="${R_NS}" ` +
        `xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ` +
        `xmlns:wp="${WP_NS}" ` +
        `xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ` +
        `xmlns:wps="${WPS_NS}" ` +
        `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
        `xmlns:v="urn:schemas-microsoft-com:vml" ` +
        `xmlns:w10="urn:schemas-microsoft-com:office:word" ` +
        `xmlns:w="${W_NS}" ` +
        `xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ` +
        `xmlns:a="${A_NS}" ` +
        `mc:Ignorable="w14 wp14">` +
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

export async function generateDocxBlob(documentXml: string): Promise<Blob> {
    const contentTypes = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
        `</Types>`
    );
    const rels = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
        `</Relationships>`
    );
    const core = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
        `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
        `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:creator>drawio2docx</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">2026-08-08T00:00:00Z</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">2026-08-08T00:00:00Z</dcterms:modified>` +
        `</cp:coreProperties>`
    );
    const app = (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
        `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
        `<Application>drawio2docx converter</Application>` +
        `</Properties>`
    );
    
    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rels);
    zip.file('word/document.xml', documentXml);
    zip.file('docProps/core.xml', core);
    zip.file('docProps/app.xml', app);
    
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function decodeDrawioRaw(raw: ArrayBuffer): string {
    const arr = new Uint8Array(raw);
    try {
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(arr);
        let clean = text.trim();
        
        try {
            const doc = parseXmlDoc(clean);
            
            if (!doc.querySelector('parsererror')) {
                const diagram = doc.querySelector('diagram');
                if (diagram && diagram.textContent && !diagram.querySelector('*')) {
                    const content = diagram.textContent.trim();
                    if (content.startsWith('H4sI') || /^[A-Za-z0-9+/=\s]+$/.test(content)) {
                        clean = content;
                    }
                }
            }
        } catch (e) {
            // ignore
        }
        
        if (clean.startsWith('<mxfile') || clean.startsWith('<?xml') || clean.startsWith('<mxGraphModel')) {
            return clean;
        }

        if (clean.startsWith('H4sI') || /^[A-Za-z0-9+/=\s]+$/.test(clean)) {
            clean = clean.replace(/\s/g, '');
            const binaryString = atob(clean);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            try {
                const decompressed = fflate.gunzipSync(bytes);
                return decodeURIComponent(fflate.strFromU8(decompressed));
            } catch (e) {
                 try {
                     const decompressed = fflate.unzlibSync(bytes);
                     return decodeURIComponent(fflate.strFromU8(decompressed));
                 } catch(e2) {
                     console.warn("fflate decompression failed");
                 }
            }
        }
        return text;
    } catch(e) {
        console.error("Failed to decode file", e);
        throw e;
    }
}

export async function processDrawioToDocx(fileBuffer: ArrayBuffer): Promise<{blob: Blob, stats: {vertices: number, edges: number}}> {
    const xmlText = decodeDrawioRaw(fileBuffer);
    
    const doc = parseXmlDoc(xmlText);
    
    const mxCells = Array.from(doc.querySelectorAll('mxCell'));
    const cellsMap = new Map<string, Element>();
    
    for (const c of mxCells) {
        const id = c.getAttribute('id');
        if (id) {
            cellsMap.set(id, c);
        }
    }
    
    const edges = mxCells.filter(c => c.getAttribute('edge') === '1');
    const edgeIds = new Set(edges.map(e => e.getAttribute('id')));

    const isEdgeChild = (c: Element) => {
        const parentId = c.getAttribute('parent');
        if (parentId && edgeIds.has(parentId)) return true;
        const style = c.getAttribute('style') || '';
        if (style.includes('edgeLabel')) return true;
        return false;
    };

    const vertices = mxCells.filter(c => 
        c.getAttribute('vertex') === '1' && 
        c.querySelector('mxGeometry') && 
        !isEdgeChild(c)
    );
    
    const allX: number[] = [];
    const allY: number[] = [];

    const addBox = (x: number, y: number, w: number, h: number) => {
        allX.push(x, x + w);
        allY.push(y, y + h);
    };

    const addPoint = (x: number, y: number) => {
        allX.push(x);
        allY.push(y);
    };

    for (const v of vertices) {
        const g = geomOf(v, cellsMap);
        if (g) addBox(g[0], g[1], g[2], g[3]);
    }

    for (const e of edges) {
        const data = edgePoints(e, cellsMap);
        if (data && data.path) {
            for (const pt of data.path) {
                addPoint(pt[0], pt[1]);
            }
        }
        const val = e.getAttribute('value') || '';
        if (val.trim()) {
            const box = getEdgeLabelBox(e, cellsMap);
            if (box) addBox(box.x, box.y, box.w, box.h);
        }
        const edgeId = e.getAttribute('id');
        if (edgeId) {
            const childLabels = mxCells.filter(c => c.getAttribute('parent') === edgeId);
            for (const c of childLabels) {
                const cVal = c.getAttribute('value') || '';
                if (cVal.trim()) {
                    const box = getEdgeLabelBox(c, cellsMap);
                    if (box) addBox(box.x, box.y, box.w, box.h);
                }
            }
        }
    }

    const minX = allX.length ? Math.min(...allX) : 0;
    const minY = allY.length ? Math.min(...allY) : 0;
    const maxX = allX.length ? Math.max(...allX) : 850;
    const maxY = allY.length ? Math.max(...allY) : 1100;

    const groupW = Math.max(10, maxX - minX);
    const groupH = Math.max(10, maxY - minY);
    const cx = Math.max(1, Math.round(groupW * EMU));
    const cy = Math.max(1, Math.round(groupH * EMU));

    let z = 0;
    const childXmls = [];

    // 1. Render edges
    for (const e of edges) {
        z++;
        const wsp = edgeWsp(e, z, `Connector ${z}`, cellsMap, minX, minY);
        if (wsp) childXmls.push(wsp);
    }

    // 2. Render edge labels
    for (const e of edges) {
        const val = e.getAttribute('value') || '';
        if (val.trim()) {
            z++;
            const wsp = edgeLabelWsp(e, z, `EdgeLabel ${z}`, cellsMap, minX, minY);
            if (wsp) childXmls.push(wsp);
        }

        const edgeId = e.getAttribute('id');
        if (edgeId) {
            const childLabels = mxCells.filter(c => c.getAttribute('parent') === edgeId);
            for (const c of childLabels) {
                const cVal = c.getAttribute('value') || '';
                if (cVal.trim()) {
                    z++;
                    let labelName = `EdgeLabel ${z}`;
                    const lines = parseValue(cVal);
                    if (lines.length > 0 && lines[0][1].length > 0) {
                        const first = lines[0][1].map(r => r.text).join('').trim();
                        if (first) labelName = first;
                    }
                    const wsp = edgeLabelWsp(c, z, labelName, cellsMap, minX, minY);
                    if (wsp) childXmls.push(wsp);
                }
            }
        }
    }

    // 3. Render vertices
    for (const v of vertices) {
        z++;
        const value = v.getAttribute('value') || '';
        const lines = parseValue(value);
        let name = `Shape ${z}`;
        if (lines.length > 0 && lines[0][1].length > 0) {
            const first = lines[0][1].map(r => r.text).join('').trim();
            if (first) name = first;
        }
        const wsp = vertexWsp(v, z, name, cellsMap, minX, minY);
        if (wsp) childXmls.push(wsp);
    }

    // Group all shapes, connections, and texts into 1 group (wpg:wgp)
    const groupXml = (
        `<w:drawing>` +
        `<wp:anchor distT="0" distB="0" distL="0" distR="0" ` +
        `simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" ` +
        `layoutInCell="1" allowOverlap="1">` +
        `<wp:simplePos x="0" y="0"/>` +
        `<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
        `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:wrapNone/>` +
        `<wp:docPr id="1" name="Diagram Group"/>` +
        `<wp:cNvGraphicFramePr/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">` +
        `<wpg:wgp xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ` +
        `xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">` +
        `<wpg:cNvPr id="1" name="Group Container"/>` +
        `<wpg:cNvGrpSpPr/>` +
        `<wpg:grpSpPr>` +
        `<a:xfrm>` +
        `<a:off x="0" y="0"/>` +
        `<a:ext cx="${cx}" cy="${cy}"/>` +
        `<a:chOff x="0" y="0"/>` +
        `<a:chExt cx="${cx}" cy="${cy}"/>` +
        `</a:xfrm>` +
        `</wpg:grpSpPr>` +
        childXmls.join('') +
        `</wpg:wgp>` +
        `</a:graphicData>` +
        `</a:graphic>` +
        `</wp:anchor>` +
        `</w:drawing>`
    );

    const body = `<w:p><w:pPr><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:noProof/><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>${groupXml}</w:r></w:p>`;

    const documentXml = buildDocument(body);
    const blob = await generateDocxBlob(documentXml);
    return { blob, stats: { vertices: vertices.length, edges: edges.length } };
}
