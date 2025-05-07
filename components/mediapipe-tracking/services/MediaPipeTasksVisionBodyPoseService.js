import { MPBodyPose } from '../processors/MediaPipeBodyPoseProcessor';
import {DrawingUtils, PoseLandmarker} from "@mediapipe/tasks-vision";

const wasmBinaryPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', import.meta.url).href;
const wasmLoaderPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', import.meta.url).href;

export class MediaPipeTasksVisionBodyPoseService {
    // This tracked creates a mediapipe/pose detector for tracking multiple body skeletons.
    // Designed to be constructed with a MediaPipeServiceProvider, to provide its images.
    constructor(serviceProvider) {
        // Our input frames will come from here.
        this.serviceProvider = serviceProvider;
        this.videoElement = this.serviceProvider.videoElement;
        this.canvasElement = this.serviceProvider.canvasElement;
        this.canvasCtx = this.serviceProvider.tasksVisionCanvasCtx;
        this.drawingUtils = new DrawingUtils(this.canvasCtx);

        // The cached results, which get set when a new Image frame is given to the pose detector and processed (onResults)
        this.bodyPoseResults = null;
        this.trackedBodyPoses = [ new MPBodyPose(null, serviceProvider.checkHeadTurn), new MPBodyPose(null, serviceProvider.checkHeadTurn) ];
        this.poseLandmarker = null;

        // Fresh data is indicated the landmarks are new this frame, otherwise they are recycled from previous frames
        this.freshData = false;
    }

    async InitialisePoseDetector(maxBodies = 2) {
        let vision = {
            'wasmBinaryPath' : wasmBinaryPathURL,
            'wasmLoaderPath' : wasmLoaderPathURL,
        }

        console.log('Initialising Body PoseDetector, numPoses: ' + maxBodies);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: maxBodies
        });
        return vision;
    };

    async updatePoseFromImage(input){
        let startTimeMs = performance.now();
        this.poseLandmarker.detectForVideo(input, startTimeMs, (result) => {
            this.onResults(result);
        });
    }

    onResults(results) {
        this.bodyPoseResults = results;
        this.freshData = true;
    }

    updateFromCachedResult(){
        // The Service Provider's job is to call this, on new Animation frame, or tick of choosing...
        // Draw the overlays.
        let results = this.bodyPoseResults;
        if (results === null){
            console.warn("updateCachedResult, result was null!");
            return;
        }

        if (results.landmarks !== undefined) 
        {
            this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            let index = 0;
            
            for (const landmark of results.landmarks) {
                this.trackedBodyPoses[index].UpdateBodyHandsFromResults(landmark, this.canvasElement.width, this.canvasElement.height);
                if (this.serviceProvider.showLandmarksToggle.options.showLandmarks)
                {
                    this.drawingUtils.drawLandmarks(landmark, {
                        radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
                    });
                    this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
                    this.trackedBodyPoses[index].DrawDebugVisuals(this.canvasCtx, this.canvasElement.width, this.canvasElement.height);
                }
                index++;
            }
            if (index < 2)
            {
                this.trackedBodyPoses[index].UpdateBodyHandsFromResults(null, this.canvasElement.width, this.canvasElement.height);
            }
            this.freshData = false;
        }
        else
        {
            this.trackedBodyPoses[0].UpdateBodyHandsFromResults(null, this.canvasElement.width, this.canvasElement.height);
            this.trackedBodyPoses[1].UpdateBodyHandsFromResults(null, this.canvasElement.width, this.canvasElement.height);
        }
        return this.trackedBodyPoses;
}
}