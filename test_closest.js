function getRouting(sx, sy, w1, h1, ex, ey, w2, h2) {
    const distY = Math.abs(sy - ey) - (h1 + h2) / 2;
    const distX = Math.abs(sx - ex) - (w1 + w2) / 2;
    
    // If they overlap horizontally (distX < 0), they are stacked vertically. Connect vertical.
    if (distX < 0) return true; // vert = true
    // If they overlap vertically (distY < 0), they are side-by-side. Connect horizontal.
    if (distY < 0) return false;
    
    // If both > 0, they are diagonally separated.
    // Connect the faces that are closer?
    // Wait, if distY = 50 (bottom to top is 50), and distX = 200 (right to left is 200).
    // The bottom face is closer to the top face than the side face is to the side face.
    // Wait, no. If distY is 50, the vertical gap is 50. The distance between the bottom edge and top edge is sqrt(50^2 + dx^2)? No, we just route vertically so the edge goes down 25, over dx, down 25.
    // If we route horizontally, the edge goes over 100, down dy, over 100.
    // Draw.io usually prefers connecting the faces that have the larger overlap, or if no overlap, the ones that are closer in the perpendicular axis?
    // Actually, draw.io orthogonal router defaults to `vert = true` for most flowchart cases unless the shapes are placed clearly side-by-side.
    // Let's use distY < distX to prefer vertical when the vertical gap is smaller than the horizontal gap.
    return distY < distX;
}

console.log(getRouting(475, 130, 350, 60,  125, 230, 150, 60)); 
