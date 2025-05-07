import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/examples/jsm/Addons.js';

const modelURL = new URL('../media/models/Sharky.glb', import.meta.url).href; // Replace with the path to your GLB model
const textureURL = new URL('../media/5of12Env_1K.exr', import.meta.url).href; // Replace with the path to your HDRI texture

const init = () => {
    // Create the scene
    const scene = new THREE.Scene();
    let modelForViewing = null;
    const raycaster = new THREE.Raycaster();

    // Set up the camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.set(1, 0.5, 1);

    // Set up the renderer 
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Add tone mapping
    renderer.toneMappingExposure = 1.2; // Adjust exposure
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
    document.body.appendChild(renderer.domElement);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.top = "0px";
    // renderer.domElement.style.zIndex = "-10";

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minPolarAngle = -Math.PI / 4; // Limit vertical rotation
    controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
    controls.enableZoom = false;
    
    // Load an EXR HDRI environment map with PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    // Load the exr using the EXRLoader
    const exrLoader = new EXRLoader();
    exrLoader.load(
        textureURL, // Replace with the path to your EXR texture
        (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            envMap.encoding = THREE.sRGBEncoding;
            scene.environment = envMap;
            scene.background = envMap; // Set the background to the environment map
            scene.backgroundBlurriness = 0.5; // Adjust the background blurriness
            scene.environmentMapIntensity = 1.0; // Adjust the environment map intensity
            scene.environmentIntensity = 1.2; // Adjust the environment intensity
            texture.dispose();
            pmremGenerator.dispose();
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the EXR texture:', error);
        }
    );

    pmremGenerator.compileEquirectangularShader();

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(3, 32), // Create a circular floor
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2; // Rotate the floor to be horizontal
    floor.position.y = -0.5; // Position the floor
    floor.receiveShadow = true; // Enable receiving shadows
    floor.castShadow = false; // Enable receiving shadows
    scene.add(floor);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x4488ff, 0.25); // Soft ambient light
    scene.add(ambientLight);

    // Add a directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xccddff, 0.75);
    directionalLight.position.set(5, 12.5, 2.5); // Position the light
    directionalLight.castShadow = true; // Enable shadows
    directionalLight.shadow.mapSize.width = 1048;
    directionalLight.shadow.mapSize.height = 1048;
    scene.add(directionalLight);

    // Load a GLB model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
        modelURL, // Replace with the path to your GLB model
        (gltf) => {
            const model = gltf.scene;
            scene.add(model);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true; // Enable casting shadows
                    child.receiveShadow = true; // Enable receiving shadows
                }
            });
            modelForViewing = model; // Store the loaded model for later use
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the GLB model:', error);
        }
    );

    // Post-processing setup
    const composer = new EffectComposer(renderer);
    
    // Add RenderPass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add SSAOPass
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 0.25; // Adjust the radius for the ambient occlusion effect
    ssaoPass.minDistance = 0.01; // Minimum distance for occlusion
    ssaoPass.maxDistance = 0.1; // Maximum distance for occlusion
    composer.addPass(ssaoPass);

    // Add OutlinePass
    const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    outlinePass.edgeStrength = 3.0; // Adjust the strength of the outline
    outlinePass.edgeGlow = 0.0; // Adjust the glow of the outline
    outlinePass.edgeThickness = 1.0; // Adjust the thickness of the outline
    outlinePass.selectedObjects = [ ]; // Set the selected objects for the outline pass

    composer.addPass(outlinePass);


    const outputPass = new OutputPass();
    composer.addPass( outputPass );

    controls.addEventListener('start', () => { 
        if (modelForViewing != null)
        {
            outlinePass.selectedObjects = [ modelForViewing ]; // Set the selected objects for the outline pass
        }
    });

    controls.addEventListener('end', () => { 
        outlinePass.selectedObjects = []; // Clear the selected objects for the outline pass
    });

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        composer.render(); // Use composer instead of renderer

    };

    animate();
};

init();