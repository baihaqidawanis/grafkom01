"use strict";

var canvas;
var gl;
var program;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var vertices = [];
var vertexColors = [];
var indices = [];

// Variabel Animasi
var isAnimating = false;
var animationPreset = 'spin';
var animationTime = 0;

init();

/**
 * Fungsi utama untuk inisialisasi WebGL
 */
function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    
    // Buat model monitor yang lebih detail
    createDetailedMonitorModel();

    setupBuffers();

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    setupEventListeners();
    render();
}

/**
 * FUNGSI UNTUK MEMBUAT MODEL YANG LEBIH DETAIL
 */
function createDetailedMonitorModel() {
    const bezelColor = vec4(0.2, 0.2, 0.2, 1.0);
    const panelColor = vec4(0.05, 0.05, 0.05, 1.0);
    const standColor = vec4(0.5, 0.5, 0.5, 1.0);
    const baseColor = vec4(0.3, 0.3, 0.3, 1.0);

    const screenWidth = 0.7;
    const screenHeight = 0.42;
    const screenDepthFront = 0.02;
    const screenDepthBack = 0.05; // Ketebalan maksimal di bagian belakang
    const yOffset = 0.35;

    // 1. Buat Bingkai Depan (Bezel) dan Panel Layar
    createCubeFace(screenWidth, screenHeight, screenDepthFront, bezelColor, 0, yOffset, 0);
    createCubeFace(screenWidth * 0.92, screenHeight * 0.88, screenDepthFront + 0.001, panelColor, 0, yOffset, 0);

    // 2. Buat Panel Belakang yang Melengkung
    createCurvedBackPanel(screenWidth, screenHeight, screenDepthBack, bezelColor, 0, yOffset, 0);

    // 3. Tiang dan Alas
    const standHeight = 0.25;
    const standYPos = yOffset - (screenHeight / 2) - (standHeight / 2);
    generateCylinder(0.04, standHeight, 20, standColor, 0, standYPos, -screenDepthBack * 0.5); 
    
    // --- PERUBAHAN DI SINI ---
    const baseYPos = standYPos - (standHeight / 2) - 0.015;
    // PANGGIL createCube() UNTUK ALAS PERSEGI PANJANG
    // Parameter: lebar(X), tinggi(Y), tebal(Z), warna, posisi pusat X, Y, Z
    createCube(0.4, 0.03, 0.3, baseColor, 0, baseYPos, -screenDepthBack * 0.5);
}


/**
 * Helper function untuk membuat balok (untuk layar dan bezel)
 * Kita akan menggunakan fungsi ini juga untuk membuat alas
 */
function createCube(width, height, depth, color, cx, cy, cz) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const v = [
        vec3(-w + cx, -h + cy, d + cz), // 0
        vec3( w + cx, -h + cy, d + cz), // 1
        vec3( w + cx,  h + cy, d + cz), // 2
        vec3(-w + cx,  h + cy, d + cz), // 3
        vec3(-w + cx, -h + cy, -d + cz),// 4
        vec3( w + cx, -h + cy, -d + cz),// 5
        vec3( w + cx,  h + cy, -d + cz),// 6
        vec3(-w + cx,  h + cy, -d + cz) // 7
    ];
    
    const startIndex = vertices.length;
    vertices.push(...v);
    for (let i = 0; i < 8; i++) vertexColors.push(color);

    const cubeIndices = [
        0, 1, 2, 0, 2, 3, // Depan
        4, 5, 6, 4, 6, 7, // Belakang
        3, 2, 6, 3, 6, 7, // Atas
        0, 1, 5, 0, 5, 4, // Bawah
        4, 0, 3, 4, 3, 7, // Kiri
        1, 5, 6, 1, 6, 2  // Kanan
    ];

    for (const index of cubeIndices) {
        indices.push(startIndex + index);
    }
}

/**
 * Membuat hanya sisi depan dari sebuah balok (untuk panel layar)
 */
function createCubeFace(width, height, depth, color, cx, cy, cz) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const v = [
        vec3(-w + cx, -h + cy, d + cz),
        vec3( w + cx, -h + cy, d + cz),
        vec3( w + cx,  h + cy, d + cz),
        vec3(-w + cx,  h + cy, d + cz),
    ];
    
    const startIndex = vertices.length;
    vertices.push(...v);
    for (let i = 0; i < 4; i++) vertexColors.push(color);

    const faceIndices = [0, 1, 2, 0, 2, 3];
    for (const index of faceIndices) {
        indices.push(startIndex + index);
    }
}

// ####################################################################
// ## FUNGSI YANG HILANG SEBELUMNYA, SEKARANG SUDAH ADA DI SINI ##
// ####################################################################
/**
 * FUNGSI BARU: Membuat panel belakang melengkung & menyambungkannya
 */
function createCurvedBackPanel(width, height, maxDepth, color, cx, cy, cz) {
    const w = width / 2;
    const h = height / 2;
    const segments = 20; // Jumlah pembagian untuk membuat kurva

    const startIndex = vertices.length;
    const backVertices = [];
    
    // Generate grid vertices untuk permukaan melengkung
    for (let j = 0; j <= segments; j++) {
        for (let i = 0; i <= segments; i++) {
            const u = i / segments; // 0 to 1
            const v = j / segments; // 0 to 1

            const x = cx + (u * width) - w;
            const y = cy + (v * height) - h;
            // Gunakan cosinus untuk membuat lekukan di sumbu Z
            const z = cz - (maxDepth * Math.cos((u - 0.5) * Math.PI));
            
            backVertices.push(vec3(x, y, z));
        }
    }
    
    vertices.push(...backVertices);
    for (let i = 0; i < backVertices.length; i++) vertexColors.push(color);

    // Buat indices untuk permukaan melengkung
    for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
            const row1 = j * (segments + 1);
            const row2 = (j + 1) * (segments + 1);
            indices.push(startIndex + row1 + i, startIndex + row1 + i + 1, startIndex + row2 + i + 1);
            indices.push(startIndex + row1 + i, startIndex + row2 + i + 1, startIndex + row2 + i);
        }
    }

    // Sambungkan sisi-sisi (dinding) antara depan dan belakang
    const frontBezel = [
        vec3(cx-w, cy-h, cz), vec3(cx+w, cy-h, cz),
        vec3(cx+w, cy+h, cz), vec3(cx-w, cy+h, cz)
    ];
    const frontStartIndex = vertices.length;
    vertices.push(...frontBezel);
    for(let i=0; i<4; i++) vertexColors.push(color);
    
    // Dinding Atas
    indices.push(frontStartIndex+3, frontStartIndex+2, startIndex + segments*(segments+1) + segments);
    indices.push(frontStartIndex+3, startIndex + segments*(segments+1) + segments, startIndex + segments*(segments+1));
    // Dinding Bawah
    indices.push(frontStartIndex+0, frontStartIndex+1, startIndex + segments);
    indices.push(frontStartIndex+0, startIndex + segments, startIndex);
    // Dinding Kiri
    indices.push(frontStartIndex+0, frontStartIndex+3, startIndex + segments*(segments+1));
    indices.push(frontStartIndex+0, startIndex + segments*(segments+1), startIndex);
    // Dinding Kanan
    indices.push(frontStartIndex+1, frontStartIndex+2, startIndex + segments*(segments+1) + segments);
    indices.push(frontStartIndex+1, startIndex + segments*(segments+1) + segments, startIndex + segments);
}


function generateCylinder(radius, height, segments, color, cx, cy, cz) {
    const h = height / 2;
    const startIndex = vertices.length;
    const topCenter = vec3(cx, cy + h, cz);
    const bottomCenter = vec3(cx, cy - h, cz);
    vertices.push(topCenter, bottomCenter);
    vertexColors.push(color, color);
    const topCenterIndex = startIndex;
    const bottomCenterIndex = startIndex + 1;
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        const x = cx + radius * Math.cos(angle);
        const z = cz + radius * Math.sin(angle);
        vertices.push(vec3(x, cy + h, z));
        vertices.push(vec3(x, cy - h, z));
        vertexColors.push(color, color);
    }
    for (let i = 0; i < segments; i++) {
        const top1 = startIndex + 2 + i * 2;
        const bottom1 = top1 + 1;
        const top2 = startIndex + 2 + (i + 1) * 2;
        const bottom2 = top2 + 1;
        indices.push(top1, bottom1, top2);
        indices.push(bottom1, bottom2, top2);
        indices.push(topCenterIndex, top1, top2);
        indices.push(bottomCenterIndex, bottom2, bottom1);
    }
}
function setupBuffers() {
    var iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexColors), gl.STATIC_DRAW);
    var colorLoc = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    var positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);
}
function render() {
    const bgColor = document.getElementById('bg-color').value;
    let posX = parseFloat(document.getElementById('position-x').value);
    let posY = parseFloat(document.getElementById('position-y').value);
    let posZ = parseFloat(document.getElementById('position-z').value);
    let rotX = parseFloat(document.getElementById('rotation-x').value);
    let rotY = parseFloat(document.getElementById('rotation-y').value);
    let rotZ = parseFloat(document.getElementById('rotation-z').value);
    let scaleValue = parseFloat(document.getElementById('scale').value);
    if (isAnimating) {
        animationTime += 0.016;
        if (animationPreset === 'spin') {
            rotY = (animationTime * 50) % 360;
            document.getElementById('rotation-y').value = rotY.toFixed(0);
            document.getElementById('rotation-y-value').textContent = rotY.toFixed(0);
        } else if (animationPreset === 'bounce') {
            posY = 0.3 * Math.sin(animationTime * 4);
            document.getElementById('position-y').value = posY.toFixed(2);
            document.getElementById('position-y-value').textContent = posY.toFixed(2);
        } else if (animationPreset === 'pulse') {
            scaleValue = 1.0 + 0.2 * Math.sin(animationTime * 5);
            document.getElementById('scale').value = scaleValue.toFixed(2);
            document.getElementById('scale-value').textContent = scaleValue.toFixed(2);
        }
    }
    const rgb = hexToRgb(bgColor);
    gl.clearColor(rgb[0], rgb[1], rgb[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_TEST_BIT);
    let mvm = mat4();
    mvm = mult(mvm, translate(0, 0, -3));
    mvm = mult(mvm, translate(posX, posY, posZ));
    mvm = mult(mvm, rotate(rotZ, vec3(0, 0, 1)));
    mvm = mult(mvm, rotate(rotY, vec3(0, 1, 0)));
    mvm = mult(mvm, rotate(rotX, vec3(1, 0, 0)));
    mvm = mult(mvm, scale(scaleValue, scaleValue, scaleValue));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mvm));
    if (document.getElementById('wireframe-mode').checked) {
        for (let i = 0; i < indices.length; i += 3) {
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
        }
    } else {
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }
    requestAnimationFrame(render);
}
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    var bigint = parseInt(hex, 16);
    return [((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255];
}
function setupEventListeners() {
    document.getElementById('animate-btn').onclick = () => {
        isAnimating = !isAnimating;
        animationTime = 0;
        document.getElementById('animate-btn').textContent = isAnimating ? 'Stop Animasi' : 'Mulai Animasi';
    };
    document.getElementById('animation-preset').onchange = (e) => animationPreset = e.target.value;
    const sliders = ['scale', 'position-x', 'position-y', 'position-z', 'rotation-x', 'rotation-y', 'rotation-z'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const span = document.getElementById(id + '-value');
        if (slider && span) {
             slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                span.textContent = id.includes('rot') ? value.toFixed(0) : value.toFixed(2);
            });
        }
    });
}
