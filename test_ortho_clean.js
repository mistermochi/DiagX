function projectToBox(geom, px, py) {
    const left = geom[0];
    const top = geom[1];
    const right = geom[0] + geom[2];
    const bottom = geom[1] + geom[3];
    let x = Math.max(left, Math.min(px, right));
    let y = Math.max(top, Math.min(py, bottom));
    return [x, y];
}

function orthoIntersect(geom, path, isStart) {
    const left = geom[0], top = geom[1], right = geom[0]+geom[2], bottom = geom[1]+geom[3];
    let outsideIdx = -1;
    let outsidePt = null;
    
    if (isStart) {
        for (let i = 1; i < path.length; i++) {
            let p = path[i];
            if (p[0] < left || p[0] > right || p[1] < top || p[1] > bottom) {
                outsideIdx = i;
                outsidePt = p;
                break;
            }
        }
        if (outsidePt) {
            let proj = projectToBox(geom, outsidePt[0], outsidePt[1]);
            return [proj, ...path.slice(outsideIdx)];
        }
    } else {
        for (let i = path.length - 2; i >= 0; i--) {
            let p = path[i];
            if (p[0] < left || p[0] > right || p[1] < top || p[1] > bottom) {
                outsideIdx = i;
                outsidePt = p;
                break;
            }
        }
        if (outsidePt) {
            let proj = projectToBox(geom, outsidePt[0], outsidePt[1]);
            return [...path.slice(0, outsideIdx + 1), proj];
        }
    }
    return path;
}

// 2-wp test
let path = [[475, 130], [320, 130], [320, 180], [125, 180], [125, 230]];
path = orthoIntersect([300, 100, 350, 60], path, true);
path = orthoIntersect([50, 200, 150, 60], path, false);
console.log("2-wp final:", path);
