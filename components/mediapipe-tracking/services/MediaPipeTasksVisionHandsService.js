import {DrawingUtils, HandLandmarker} from "@mediapipe/tasks-vision";

const wasmBinaryPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', import.meta.url).href;
const wasmLoaderPathURL = new URL('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', import.meta.url).href;

export class MediaPipeTaskVisionHandsService {
    // This tracked creates a mediapipe/pose detector for tracking hands.
    // Designed to be constructed with a MediaPipeServiceProvider, to provide its images.
    // Drawing hands currently has a dependency on People from MediaPipeServiceProvider (see getAssociatedHandsForPeople)
    constructor(serviceProvider) {
        // Our input frames will come from here.
        this.serviceProvider = serviceProvider;
        this.videoElement = this.serviceProvider.videoElement;
        this.canvasElement = this.serviceProvider.canvasElement;
        this.canvasCtx = this.serviceProvider.canvasCtx;
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
        this.hands = null;

        // The cached results, which get set when a new Image frame is given to the pose detector and processed (onResults)
        this.handPoseResults = null;
        this.freshHands = false;
    }

    async InitialiseHandDetector(maxHands = 4){
        let vision = {
            'wasmBinaryPath' : wasmBinaryPathURL,
            'wasmLoaderPath' : wasmLoaderPathURL,
        }

        this.hands = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: maxHands
        });

        console.log("Initialised MediaPipeTaskVisionHandsService with numHands:" + maxHands);
        return vision;
    }

    async updatePoseFromImage(input){
        let startTimeMs = performance.now();
        this.handPoseResults = this.hands.detectForVideo(input, startTimeMs);
        this.freshHands = true;
    }

    getAssociatedHandsForPeople(people = null){
        // The Service Provider's job is to call this, on new Animation frame, or tick of choosing...
        // this.handPoseResults is a cached or 'current' hand pose result
        let handResults = this.handPoseResults;
        if (handResults === null){
            return;
        }

        // Assuming a maximum of Two people in a Scene, we can have to sets of hands.
        let associatedHands = [[], []]; // [ PERSON0-HANDS[], PERSON1-HANDS[] ]

        // From each of the given People, get the hands associated with that person...
        if (people != null)
        {
            associatedHands = this.associateHandsWithPeople(handResults, people);
        }

        // Optionally Draw Associated Hand Landmarks...
        if (this.serviceProvider.showLandmarksToggle.options.showLandmarks){
            this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            let person0Hands = associatedHands[0];
            let person1Hands = associatedHands[1];
            // Draw person0 landmarks...
            if (person0Hands.length > 0){
                for (let handIndex = 0; handIndex < person0Hands.length; handIndex++){
                    let handResults = person0Hands[handIndex];
                    for (let index = 0; index < handResults.landmarks.length; index++) {
                        const classification = handResults.handednesses;
                        const chirality = classification[0].displayName;
                        const isRightHand = chirality === 'Right';
                        const landmarks = handResults.landmarks;
                        this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS);
                        this.drawingUtils.drawLandmarks(landmarks, { color: isRightHand ? '#e4ff00' : '#ff0000' });
                    }
                }
            }
            // And optionally person1 landmarks...
            if (person1Hands.length > 0){
                for (let handIndex = 0; handIndex < person1Hands.length; handIndex++){
                    let handResults = person1Hands[handIndex];
                    for (let index = 0; index < handResults.landmarks.length; index++) {
                        const classification = handResults.handednesses;
                        const chirality = classification[0].displayName;
                        const isRightHand = chirality === 'Right';
                        const landmarks = handResults.landmarks;
                        this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS);
                        this.drawingUtils.drawLandmarks(landmarks, { color: isRightHand ? '#006fff' : '#2eff00' });
                    }
                }
            }
        }
        return associatedHands;
    }

    associateHandsWithPeople(handResults, people) {
        // Return a list of people, with associated hands...
        let associatedHands = [[], []]; // [ PERSON0-HANDS[], PERSON1-HANDS[] ]
        const wristBL = 15;
        const wristBR = 16;
        const wristH = 0;

        // For the two possible people...
        for (const ix in people) {
            let person = people[ix];
            // Check to see if there are any hand results, within a threshold and associate them with a body...
            for (let index = 0; index < handResults.landmarks.length; index++){
                const landmarks = handResults.landmarks[index];
                if (person.body.poseData.poseLandmarks != null){
                    const dLeftWrist = person.body.poseData.poseLandmarks[wristBL].x - landmarks[wristH].x;
                    const dRightWrist = person.body.poseData.poseLandmarks[wristBR].x - landmarks[wristH].x;
                    const closestDist = Math.min (Math.abs(dLeftWrist), Math.abs(dRightWrist));

                    if (closestDist < 0.2)
                    {
                        let handednessesCheck = handResults.handednesses[index];

                        let chiralityCheck = handednessesCheck[0].displayName;
                        if (associatedHands[ix].length > 0){
                            for (let assHandsIx = 0; assHandsIx < associatedHands.length; assHandsIx++){
                                let currentHand = associatedHands[ix][assHandsIx];
                                let handsTheSame = currentHand.handednesses.displayName === chiralityCheck;
                                let newHandIsCloser = (closestDist < currentHand.handDistance);
                                if (!handsTheSame || (handsTheSame && newHandIsCloser)) {
                                    associatedHands[ix].push({
                                        landmarks: handResults.landmarks[index],
                                        worldLandmarks: handResults.worldLandmarks[index],
                                        handednesses: handResults.handednesses[index],
                                        handDistance: closestDist
                                    });
                                }
                                else{
                                    console.warn("We have more than one hand chirality for: " + chiralityCheck);
                                }
                            }
                        }
                        else{
                            associatedHands[ix].push({
                                landmarks: handResults.landmarks[index],
                                worldLandmarks: handResults.worldLandmarks[index],
                                handednesses: handResults.handednesses[index],
                                handDistance: closestDist
                            });
                        }
                    }
                }
            }
        }
        return associatedHands;
    }
}
