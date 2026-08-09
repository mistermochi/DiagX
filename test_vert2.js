function getRouting(sx, sy, w1, h1, ex, ey, w2, h2) {
    const distY = Math.abs(sy - ey) - (h1 + h2) / 2;
    const distX = Math.abs(sx - ex) - (w1 + w2) / 2;
    
    if (distX < 0) return true;
    if (distY < 0) return false;
    return distY <= distX;
}

// Top box to Left box
// Top: x=300, y=100, w=350, h=60 => sx=475, sy=130
// Left: x=50, y=200, w=150, h=60 => ex=125, ey=230
console.log("Left:", getRouting(475, 130, 350, 60,  125, 230, 150, 60)); 

// Top to Right box
// Right: x=600, y=200, w=150, h=60 => ex=675, ey=230
console.log("Right:", getRouting(475, 130, 350, 60,  675, 230, 150, 60));

// Top to Middle box
// Middle: x=300, y=200, w=150, h=60 => ex=375, ey=230
console.log("Middle:", getRouting(475, 130, 350, 60,  375, 230, 150, 60));
