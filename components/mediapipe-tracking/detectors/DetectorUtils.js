// Utilities for Hand Feature Detectors

import {ExtendedFingerMask} from "./MediaPipeGrabDetector.js";

export const Clamp = (val, min = 0, max = 1) => Math.max(min, Math.min(max, val));
const PALM_IDs = [0, 5, 17]
export const FINGERTIP_IDs = [4, 8, 12, 16, 20]
export function PalmForward(mpTinyHand)
{
    const landmarks = mpTinyHand.landmarks;
    const wrist = landmarks[PALM_IDs[0]];
    const indexKnuckle = landmarks[PALM_IDs[1]];
    const pinkyKnuckle = landmarks[PALM_IDs[2]];

    const width = Math.abs(pinkyKnuckle.x - indexKnuckle.x);
    const height = Math.abs(wrist.y - indexKnuckle.y);

    const depth = Math.max(
        Math.abs(wrist.z - indexKnuckle.z),
        Math.abs(wrist.z - pinkyKnuckle.z),
        Math.abs(pinkyKnuckle.z - indexKnuckle.z)
    );

    const vertical = height > width;
    const flat = depth < width;
    const forward = mpTinyHand.chirality == "Left" ?
        indexKnuckle.x < pinkyKnuckle.x :
        indexKnuckle.x > pinkyKnuckle.x ;

    return vertical && flat && forward;
}

export function ExtendedFingerCount(ExtendedFingerMask, mpTinyHand) {
    let extended_fingers = ExtendedFingerMask(mpTinyHand);
    return extended_fingers.reduce((a, b) => a + b, 0);
}