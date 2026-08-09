function projectToBox(geom, px, py) {
    const left = geom[0];
    const top = geom[1];
    const right = geom[0] + geom[2];
    const bottom = geom[1] + geom[3];
    let x = Math.max(left, Math.min(px, right));
    let y = Math.max(top, Math.min(py, bottom));
    return [x, y];
}

// 2-wp
let start_pt = [475, 130];
let insertPt = [320, 130];
let p1 = [320, 180];
let path = [start_pt, insertPt, p1];

// Find first outside point
let outsidePt = null;
const geom = [300, 100, 350, 60];
const left = geom[0], top = geom[1], right = geom[0]+geom[2], bottom = geom[1]+geom[3];

for (let i = 1; i < path.length; i++) {
    let p = path[i];
    if (p[0] < left || p[0] > right || p[1] < top || p[1] > bottom) {
        outsidePt = p;
        break;
    }
}
if (outsidePt) {
    path[0] = projectToBox(geom, outsidePt[0], outsidePt[1]);
} else {
    // all inside? fallback to perimeterIntersect on first segment
}
// Then we remove any points in path that are inside the box!
// Actually, if we just set path[0] to the projected point, and remove all points before outsidePt!
let newPath = [path[0]];
let foundOutside = false;
for (let i = 1; i < path.length; i++) {
    let p = path[i];
    if (!foundOutside) {
        if (p[0] < left || p[0] > right || p[1] < top || p[1] > bottom) {
            foundOutside = true;
            newPath.push(p);
        }
    } else {
        newPath.push(p);
    }
}
console.log("2-wp path:", newPath);


// 1-wp
path = [[400, 130], [400, 200], [160, 200]];
let geom2 = [300, 100, 200, 60];
let left2 = geom2[0], top2 = geom2[1], right2 = geom2[0]+geom2[2], bottom2 = geom2[1]+geom2[3];

outsidePt = null;
for (let i = 1; i < path.length; i++) {
    let p = path[i];
    if (p[0] < left2 || p[0] > right2 || p[1] < top2 || p[1] > bottom2) {
        outsidePt = p;
        break;
    }
}
if (outsidePt) {
    path[0] = projectToBox(geom2, outsidePt[0], outsidePt[1]);
}
newPath = [path[0]];
foundOutside = false;
for (let i = 1; i < path.length; i++) {
    let p = path[i];
    if (!foundOutside) {
        if (p[0] < left2 || p[0] > right2 || p[1] < top2 || p[1] > bottom2) {
            foundOutside = true;
            newPath.push(p);
        }
    } else {
        newPath.push(p);
    }
}
console.log("1-wp path:", newPath);
