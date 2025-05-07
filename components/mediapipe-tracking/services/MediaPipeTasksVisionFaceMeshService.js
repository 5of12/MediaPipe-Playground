import {DrawingUtils, FaceLandmarker} from "@mediapipe/tasks-vision";

const wasmBinaryPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', import.meta.url).href;
const wasmLoaderPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', import.meta.url).href;

export class MediaPipeTaskVisionFaceMeshService {
    // This tracked creates a mediapipe/pose detector for tracking face meshes.
    // Designed to be constructed with a MediaPipeServiceProvider, to provide its images.
    constructor(serviceProvider) {
        // Our input frames will come from here.
        this.serviceProvider = serviceProvider;
        this.videoElement = this.serviceProvider.videoElement;
        this.canvasElement = this.serviceProvider.canvasElement;
        this.canvasCtx = this.serviceProvider.canvasCtx;
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
        this.faceLandmarker = null;

        // The cached results, which get set when a new Image frame is given to the pose detector and processed (onResults)
        this.facePoseResults = null;
    }

    async InitialiseFaceMeshDetector(maxFaces = 2){
        let vision = {
            'wasmBinaryPath' : wasmBinaryPathURL,
            'wasmLoaderPath' : wasmLoaderPathURL,
        }

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            runningMode: "VIDEO",
            numFaces: 1
        });

        console.log("Initialised MediaPipeTaskFaceMeshService:");
        return vision;
    }

    async updateFaceFromImage(input){
        let startTimeMs = performance.now();
        this.facePoseResults = this.faceLandmarker.detectForVideo(input, startTimeMs);
    }

    updateFromCachedResult() {
        // The Service Provider's job is to call this, on new Animation frame, or tick of choosing...
        // Draw the overlays.
        let results = this.facePoseResults;
        if (results === null) {
            return;
        }
        // Optionally Draw...
        if (this.serviceProvider.showLandmarksToggle.options.showLandmarks) {
            if (results.faceLandmarks) {
                for (const landmarks of results.faceLandmarks) {
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                        {color: "#C0C0C070", lineWidth: 1}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                        {color: "#FF3030"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
                        {color: "#FF3030"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                        {color: "#30FF30"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                        {color: "#30FF30"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                        {color: "#E0E0E0"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_LIPS,
                        {color: "#E0E0E0"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
                        {color: "#FF3030"}
                    );
                    this.drawingUtils.drawConnectors(
                        landmarks,
                        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
                        {color: "#30FF30"}
                    );
                }
            }
        }
        return results;
    }
}
