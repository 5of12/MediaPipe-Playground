import {FINGERTIP_IDs, PalmForward, Clamp, ExtendedFingerCount} from "./DetectorUtils.js";

export class GrabHeldForDurationDetector
{
    // Used to detect a forward-facing Grab pose with all fingers not-extended, palm facing forwards
    constructor(holdThreshold = 1500)
    {
        this.holdThreshold = holdThreshold;
        this.currentPoseHoldDuration = 0;
        this.lastFingerExtendedCount = 0;
        this.poseCompleted = false;
        this.poseProgress = 0;
        this.poseState = "NONE";
    }

    Update(delta, hand){
        let newExtendedFingerCount = ExtendedFingerCount(ExtendedFingerMask, hand);
        let palmForward = PalmForward(hand);

        if (palmForward && newExtendedFingerCount === 0 && newExtendedFingerCount === this.lastFingerExtendedCount) {
            if (!this.poseCompleted) {
                this.currentPoseHoldDuration += delta;
                this.poseProgress = Clamp(this.currentPoseHoldDuration / this.holdThreshold, 0.0, 1.0);
                if (this.poseProgress >= 1) {
                    this.poseState = "CONFIRM";
                    this.poseCompleted = true;
                } else {
                    this.poseState = "GRABBING"
                }
            }
        }
        else{
            this.currentPoseHoldDuration = 0;
            this.poseProgress = 0;
            this.poseCompleted = false;
            this.poseState = "NONE";
        }
        this.lastFingerExtendedCount = newExtendedFingerCount;
    }
}

export function ExtendedFingerMask(mpTinyHand){
    let landmarks = mpTinyHand.landmarks;

    // We'll end up with a bit-mask e.g [0,1,1,0,1] for finger extended (1) or not (0)...
    let extended_fingers=[]
    let thumbPtB = landmarks[FINGERTIP_IDs[0] - 1].x;
    let thumbPtA = landmarks[FINGERTIP_IDs[0]].x;

    if (mpTinyHand.chirality === "Right") {
        thumbPtA = landmarks[FINGERTIP_IDs[0] - 1].x;
        thumbPtB = landmarks[FINGERTIP_IDs[0]].x;
    }
    // Thumb extension is looking at X-coordinate tip being further extended than the previous joint...
    if (thumbPtA < thumbPtB) {
        extended_fingers.push(1)
    }
    else {
        extended_fingers.push(0);
    }

    // For other fingers, look at the y-value, with tip being above the prev. joint...
    for (let id = 1; id < FINGERTIP_IDs.length; id++) {
        if (landmarks[FINGERTIP_IDs[id]].y < landmarks[FINGERTIP_IDs[id]-2].y){
            extended_fingers.push(1)
        }
        else {
            extended_fingers.push(0)
        }
    }

    return extended_fingers;
}