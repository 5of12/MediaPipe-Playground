import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const width = window.innerWidth;
const height = window.innerHeight ;
const leftColor = new THREE.Color().setHSL(0.6 , 1, 0.5, THREE.SRGBColorSpace);
const rightColor = new THREE.Color().setHSL(0.1 , 1, 0.5, THREE.SRGBColorSpace);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
camera.position.set( 0, 0, 500 );
camera.lookAt( 0, 0, 0 );

const renderer = new THREE.WebGLRenderer( { antialias: true } );

renderer.setClearColor(new THREE.Color(), 0);

renderer.domElement.style.position = "fixed";
renderer.domElement.style.top = "0";
renderer.domElement.style.pointerEvents = "none";
renderer.domElement.style.zIndex = 100;

renderer.setSize( width, height);
renderer.domElement.style.background = "transparent";
document.body.appendChild( renderer.domElement );

const zoomLineMaterial = new LineMaterial( {
	color: 0xffffff,
	linewidth: 5,
    alphaToCoverage: false,
    dashed: false,
    vertexColors: true,
    worldUnits: true
} );

const panLineMaterial = new LineMaterial( {
	color: 0xe3e3e3,
	linewidth: 3,
    alphaToCoverage: true,
    dashed: true,
    dashScale: 1,
    gapSize: 10,
    dashSize: 10,
    vertexColors: false,
    worldUnits: true
} );

let zoomLinePoints = [];
let point = new THREE.Vector3( 0, 0, 0 );
zoomLinePoints.push( point.x, point.y, point.z );
zoomLinePoints.push( point.x, point.y, point.z );

const colors = [];
colors.push(leftColor.r, leftColor.g, leftColor.b );
colors.push(rightColor.r, rightColor.g, rightColor.b );

const zoomLineGeometry = new LineGeometry();
zoomLineGeometry.setPositions( zoomLinePoints );
zoomLineGeometry.setColors( colors );

const zoomLine = new Line2( zoomLineGeometry, zoomLineMaterial );
zoomLine.computeLineDistances();
scene.add ( zoomLine );

let panLinePoints = [];
const panLineGeometry = new LineGeometry();
const panLine = new Line2 ( panLineGeometry, panLineMaterial );
scene.add ( panLine );

const dotGeo = new THREE.CircleGeometry( 5, 32 ); 
const dotMat = new THREE.MeshBasicMaterial( { color: rightColor } ); 
const dot = new THREE.Mesh( dotGeo, dotMat ); 
scene.add( dot );

let handGeoL = new LineGeometry();
let handGeoR = new LineGeometry();
let handGeoLB = new LineGeometry();
let handGeoRB = new LineGeometry();
let handMaterial = new LineMaterial({
    color: 0xffffff,
    linewidth: 5,
    worldUnits: false,
    vertexColors: true,  
});
let handMaterialBack = new LineMaterial({
    color: 0x2e2e2e,
    linewidth: 7,
    worldUnits: false,
});

const handLineL = new Line2 ( handGeoL, handMaterial) ;
const handLineLB = new Line2 ( handGeoLB, handMaterialBack) ;
const handLineR = new Line2 ( handGeoR, handMaterial) ;
const handLineRB = new Line2 ( handGeoRB, handMaterialBack) ;
scene.add ( handLineL, handLineR , handLineLB, handLineRB);

export function updateRubberBand (newPoints) 
{
    zoomLinePoints = [];
    zoomLinePoints.push (newPoints[0].x, newPoints[0].y, newPoints[0].z);
    zoomLinePoints.push (newPoints[1].x, newPoints[1].y, newPoints[1].z);
    zoomLineGeometry.setPositions ( zoomLinePoints );
};

export function updateDot (newPos)
{
    dot.position.set (newPos.x, newPos.y, newPos.z);
}

export function showHideAll(visible){
    showHideBand(visible);
    showHideDot(visible)
    showHideHands(visible, visible);
    panLine.visible = visible;
    renderer.clear();
}

export function showHideBand(visible)
{
    zoomLine.visible = visible;
}

export function showHideDot(visible)
{
    dot.visible = visible;
}

export function showHideHands(first, second)
{
    handLineL.visible = first;
    handLineR.visible = second;
    handLineLB.visible = first;
    handLineRB.visible = second;
}

export function showHidePanLine(visible)
{
    panLine.visible = visible;
}

export function updatePanLine(endPosition)
{
    if (panLine.visible == false)
    {
        panLinePoints = [];
        panLinePoints.push(endPosition.x, endPosition.y, endPosition.z);
        panLinePoints.push(endPosition.x, endPosition.y, endPosition.z);
        panLineGeometry.setPositions (panLinePoints);
        panLine.visible = true;
    }
    else
    {
        panLinePoints[3] = endPosition.x;
        panLinePoints[4] = endPosition.y;
        panLinePoints[5] = endPosition.z;
        panLineGeometry.setPositions (panLinePoints);
        panLine.computeLineDistances();
    }
}

window.addEventListener('resize', () => {
    let newWidth = window.innerWidth;
    let newHeight = window.innerHeight;

    camera.left = newWidth / -2;
    camera.right = newWidth / 2;
    camera.top = newHeight / 2;
    camera.bottom = newHeight / -2;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight );
    renderer.render(scene, camera);
});

const fingerColors = [
    new THREE.Color().setHSL(0.6 , 0, 1, THREE.SRGBColorSpace),
    new THREE.Color().setHSL(0.6 , 0, 1, THREE.SRGBColorSpace),
    new THREE.Color().setHSL(0.6 , 0, 0.85, THREE.SRGBColorSpace),
    new THREE.Color().setHSL(0.6 , 0, 0.75, THREE.SRGBColorSpace),
    new THREE.Color().setHSL(0.6 , 0, 0.65, THREE.SRGBColorSpace),
];

export const handScale = 300;
export function updateHands(pinchPositions, hands)
{
    const handScale = 300;
    let geos = [handGeoL, handGeoR, handGeoLB, handGeoRB];
    let lines = [handLineL, handLineR, handLineLB, handLineRB];
    
    for (let h = 0; h < hands.length; h++)
    {
        if (hands[h].state == 0)
        {
            lines[h].visible = false;
            lines[h+2].visible = false;
        }
        else
        {
            lines[h].visible = true;
            lines[h+2].visible = true;
        }
        
        if (hands[h].fingers.length == 0) 
            break;

        let joints = [];
        let jointColors = [];
        for (let f = 0; f < 5; f++)
        {
            let finger = []
            for (let j = 0; j < 4; j++)
            {
                let jointX = (hands[h].fingers[f].joints[j].x - hands[h].pinchPosition.x) * handScale;
                let jointY = (hands[h].fingers[f].joints[j].y - hands[h].pinchPosition.y) * handScale;
                let jointZ = (hands[h].fingers[f].joints[j].z - hands[h].pinchPosition.z) * handScale; 
                finger.push({
                    x: jointX + pinchPositions[h].x,
                    y: ((jointY + jointZ) * 0.5) + pinchPositions[h].y,
                    z: -hands[h].fingers[f].joints[j].z
                });
            }
    
            joints.push(finger[0].x, finger[0].y, finger[0].z );
            joints.push(finger[1].x, finger[1].y, finger[1].z );
            joints.push(finger[2].x, finger[2].y, finger[2].z );
            joints.push(finger[3].x, finger[3].y, finger[3].z );
            joints.push(finger[2].x, finger[2].y, finger[2].z );
            joints.push(finger[1].x, finger[1].y, finger[1].z );
            joints.push(finger[0].x, finger[0].y, finger[0].z );
            for (let c = 0; c < 7; c++)
            {
                jointColors.push(fingerColors[f].r, fingerColors[f].g, fingerColors[f].b);
            }
        }
        if (joints.length > 0)
        {
            geos[h].setPositions( joints );
            geos[h].setColors ( jointColors );
            for(let j = 2; j < joints.length; j+=3)
            {
                joints[j] -= 1;
            };
            geos[h+2].setPositions ( joints );
            lines[h].computeLineDistances();
        }
    }
}

export function updateRender()
{
    renderer.render( scene, camera );
}