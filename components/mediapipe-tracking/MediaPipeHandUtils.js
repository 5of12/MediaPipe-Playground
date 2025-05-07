// Utilities for working with MediaPipe Hand Results / Landmarks
// Helps create Data structure for TinyHands
import * as THREE from 'three';
import {ExtendedFingerMask} from "./detectors/MediaPipeFingerPoseDetector.js";
import { PalmForward } from './detectors/DetectorUtils.js';

// Used to detect pinches with MPScaledFingers
// Distances of Index > Thumb Distal bones are said to be pinching (see HandIsPinching)
const pinchThreshold = 10;

// Seems to give approximate tiny hand size matching OverlayGraphics.js
const constantWidth = 300*0.05;

// The hand is considered to be pointing if ONLY the index finger is extended...
// In the extended bitmask (Thumb->Pinky), this is: [0,1,0,0,0]
const pointing_mask = [0, 1, 0, 0, 0];

const PersistenceState = { MISSING: 0, VISIBLE: 1, POINTING: 2, PINCHING: 3, RESET: 4 };

function GetIndexTip(landmarks){
    return landmarks[8];
}
function GetThumbTip(landmarks){
    return landmarks[4];
}
function GetIndexMeta(landmarks)
{
    return landmarks[5];
}
function GetPinkyMeta(landmarks)
{
    return landmarks[17];
}

function HandIsPinching(hand){
    let pinching = false;
    let pinchDistance = GetPinchDistance(hand);
    if (pinchDistance < pinchThreshold && PalmForward(hand)){
        pinching = true;
    }
    return pinching;
}

function GetPinchDistance(hand) {
    let indexTip = hand.IndexFinger().Distal();
    let thumbTip = hand.Thumb().Distal();
    let a = new THREE.Vector3( indexTip.x, indexTip.y, indexTip.z );
    let b = new THREE.Vector3( thumbTip.x, thumbTip.y, thumbTip.z);
    return a.distanceTo( b );
}

function GetPinchPosition(landmarks) {
    let indexTip = GetIndexTip(landmarks);
    let thumbTip = GetThumbTip(landmarks);
    const pinchPos = new THREE.Vector3();
    pinchPos.addVectors(indexTip, thumbTip).divideScalar(2);
    return pinchPos;
}

function GetStablePinchPosition(landmarks)
{
    let indexMeta = GetIndexMeta(landmarks);
    let pinkyMeta = GetPinkyMeta(landmarks);
    let a = new THREE.Vector3( indexMeta.x, indexMeta.y, indexMeta.z);
    let b = new THREE.Vector3( pinkyMeta.x, pinkyMeta.y, pinkyMeta.z);
    let p = new THREE.Vector3();
    p.subVectors(a, b).divideScalar(2);
    let pinchPos = new THREE.Vector3();
    
    return pinchPos.addVectors(a, p);
}

function GetHandScale(landmarks){
    // This is an approximation of Hand Width based on indexKnuckle<->pinkyKnuckle
    let posA = landmarks[5];
    let posB = landmarks[17];
    let a = new THREE.Vector3( posA.x, posA.y, posA.z );
    let b = new THREE.Vector3( posB.x, posB.y, posB.z);
    return constantWidth / a.distanceTo( b );
}

// MediaPipe Finger Index Constants
// See: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
const thumb_joints = [1,2,3,4]
const index_joints = [5,6,7,8]
const middle_joints = [9,10,11,12]
const ring_joints = [13,14,15,16]
const pinky_joints = [17,18,19,20]
const finger_indices = [thumb_joints, index_joints, middle_joints, ring_joints, pinky_joints];

class MPScaledFinger {
    constructor(hand, landmarks, finger_indices, pinchPosition = undefined, handScale = undefined, fingerIndex) {
        let rawJoints = finger_indices.map(i => landmarks[i]);
        this.hand = hand;
        this.fingerIndex = fingerIndex;

        let pinchPos = pinchPosition;
        if (pinchPos === undefined) {
            pinchPos = GetStablePinchPosition(landmarks);
        }

        let scale = handScale;
        if (scale === undefined) {
            scale = GetHandScale(landmarks);
        }
        // Create Scaled Joints...
        this.joints = []
        for (let h = 0; h < rawJoints.length; h++) {
            let jointX = (rawJoints[h].x - pinchPos.x) * (scale);
            let jointY = (rawJoints[h].y - pinchPos.y) * (scale);
            let jointZ = (rawJoints[h].z - pinchPos.z) * (scale);
            this.joints.push({"x": jointX, "y": jointY, "z": jointZ});
        }
    }

    // Convenience methods for accessing joint positions
    MetaCarpal() {
        return this.joints[0];
    }
    Proximal() {
        return this.joints[1];
    }
    Intermediate() {
        return this.joints[2];
    }
    Distal() {
        return this.joints[3];
    }

    IsExtended(){
        let finger_mask = ExtendedFingerMask(this.hand);
        return finger_mask[this.fingerIndex] === 1;
    }
}


export class MPTinyHand {
    // TinyHand class to work with TinyHand rendering
    constructor(landmarks, classification){
        if (landmarks != null)
        {
            this.landmarks = landmarks;
            this.chirality = classification;
            this.pinchPosition = GetStablePinchPosition(landmarks);
            this.fingers = this.Fingers(landmarks);
            this.state = this.GetState();
            this.pinchID = -1;
            this.pinchAge = 0;
            this.gestureState = "NONE";
            this.gestureProgress = 0;
            this.handScale = GetHandScale(landmarks);
        }
        else
        {
            this.landmarks = null;
            this.chirality = "";
            this.pinchPosition = {x: 0, y:0, z:0};
            this.fingers = [];
            this.state = PersistenceState.MISSING;
            this.pinchID = -1;
            this.pinchAge = 0;
            this.gestureState = "NONE";
            this.gestureProgress = 0;
            this.handScale = 0;
        }
        this.pinchPosCache = [];
        this.pinchCacheLength = 3;
        this.timeLastSeen = Date.now();
        this.missingHandsTimout = 500;
    }

    GetState(){
        if (this.landmarks == null) return PersistenceState.MISSING;

        let handState = PersistenceState.VISIBLE;
        if (this.IsPointing()){
            handState = PersistenceState.POINTING;
        }
        else if (this.IsPinching()){
            handState = PersistenceState.PINCHING;
        }
        return handState;
    }

    IsPinching(){
        return HandIsPinching(this);
    }

    IsPointing(){
        let extended_mask = ExtendedFingerMask(this);
        let indexPointing = extended_mask.every((element, index) => element === pointing_mask[index]);
        return indexPointing;
    }

    Fingers(landmarks){
        let fingers = []
        let pinchPos = GetStablePinchPosition(landmarks);
        for (let i = 0; i < finger_indices.length; i++) {
            let finger = new MPScaledFinger(this, landmarks, finger_indices[i], pinchPos, this.handScale, i);
            fingers.push(finger);
        }
        return fingers;
    }

    // Convenience methods for accessing MPScaledFingers.
    Thumb(){
        return this.fingers[0];
    }

    IndexFinger(){
        return this.fingers[1];
    }

    MiddleFinger(){
        return this.fingers[2];
    }

    RingFinger(){
        return this.fingers[3];
    }

    PinkyFinger(){
        return this.fingers[4];
    }

    PinchPosition(){
        return {x: this.pinchPosition.x, y: this.pinchPosition.y, z: this.pinchPosition.z};
    }

    DeadzonePinchPosition(oldPosition, newPosition, radius)
    {
        if (oldPosition == undefined || newPosition == undefined) return { x: 0, y: 0, z: 0 };

        const newPos = new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z);
        const oldPos = new THREE.Vector3(oldPosition.x, oldPosition.y, oldPosition.z);
        const dist = newPos.distanceTo(oldPos);

        if (dist > radius)
        {
            let offset = new THREE.Vector3();
            offset.subVectors(newPos, oldPos).normalize().multiplyScalar(radius);
            let deadPos = new THREE.Vector3();
            deadPos.subVectors(newPos, offset);
            return { x: deadPos.x, y: deadPos.y, z: deadPos.z };
        }
        else
        {
            return oldPosition;
        }
    }

    EvaluatePersistentState(newState, previousState)
    {
        let state = newState;
        let timeDelta = performance.now() - this.timeLastSeen;
        if (newState == PersistenceState.MISSING)
        {
            if (timeDelta > this.missingHandsTimout)
            {
                state == PersistenceState.RESET;
            }
            else
            {
                state = previousState;
            }
        }
        else
        {
            this.timeLastSeen = performance.now();
        }

        switch(previousState)
        {
            case PersistenceState.MISSING:
                if (state == PersistenceState.VISIBLE)
                {
                    state = PersistenceState.VISIBLE;
                }
                this.pinchAge = 0;

            break;
            case PersistenceState.VISIBLE:
                if (state == PersistenceState.PINCHING)
                {
                    state = PersistenceState.PINCHING;
                    this.pinchAge = 0;
                }
                else if (state == PersistenceState.POINTING)
                {
                    state = PersistenceState.POINTING;
                }
            break;
            case PersistenceState.POINTING:
                if (state == PersistenceState.VISIBLE)
                {
                    state == PersistenceState.VISIBLE;
                }
            break;
            case PersistenceState.PINCHING:
                if (state == PersistenceState.VISIBLE)
                {
                    state == PersistenceState.VISIBLE;
                }
                else
                {
                    this.pinchAge += 1;
                }
            break;
            case PersistenceState.RESET:
                state = PersistenceState.MISSING;
                this.pinchAge = 0;

            break;
        }

        return state != undefined ? state : PersistenceState.MISSING;
    }

    GetFilteredPinchPos(newPos, freshHands)
    {
        if (freshHands)
        {
            return this.CachePinchPos(this.SmoothPinchPos(newPos));
        }
        else
        {
            if (this.pinchPosCache.length > 0)
            {
                return this.ExtrapolatePinchPos();
            }
        }
        return newPos;
    }

    // Add new results to the cache and maintain circular buffer
    CachePinchPos(newPos)
    {
        this.pinchPosCache.push({timestamp: performance.now(), position: newPos});
        if (this.pinchPosCache.length > this.pinchCacheLength)
        {
            this.pinchPosCache.shift();
        }
        return newPos;
    }

    // Return a new pinch pos that is moving average filtered
    SmoothPinchPos(newPos, smoothAmount = 0.2)
    {
        const cacheLength = this.pinchPosCache.length;
        let result = newPos;
        
        if (cacheLength > 0)
            {
            const lastCacheValue = this.pinchPosCache[cacheLength - 1];
            const minusT = 1 - smoothAmount;

            const delta = {
                x: newPos.x - lastCacheValue.position.x,
                y: newPos.y - lastCacheValue.position.y,
                z: newPos.z - lastCacheValue.position.z,
            }

            result = {
                x: lastCacheValue.position.x + (delta.x * minusT),
                y: lastCacheValue.position.y + (delta.y * minusT),
                z: lastCacheValue.position.z + (delta.z * minusT),
            }
        }
        return result;
    }

    // Return a new position based on the cache of previous values and the time elapsed
    ExtrapolatePinchPos()
    {
        const cacheLength = this.pinchPosCache.length;

        if (cacheLength == this.pinchCacheLength)
        {
            // Get the let two points and their delta
            const firstCacheValue = this.pinchPosCache[cacheLength - 2];
            const lastCacheValue = this.pinchPosCache[cacheLength - 1];

            const deltaPos = {
                x: lastCacheValue.position.x - firstCacheValue.position.x,
                y: lastCacheValue.position.y - firstCacheValue.position.y,
                z: lastCacheValue.position.z - firstCacheValue.position.z
            };
            const deltaT = lastCacheValue.timestamp - firstCacheValue.timestamp;
            const velocity = {
                x: deltaPos.x / deltaT,
                y: deltaPos.y / deltaT,
                z: deltaPos.z / deltaT
            }
            const extrapolationTime = Math.min(performance.now() - lastCacheValue.timestamp, deltaT);

            const result = {
                x: lastCacheValue.position.x + (velocity.x * extrapolationTime),
                y: lastCacheValue.position.y + (velocity.y * extrapolationTime),
                z: lastCacheValue.position.z + (velocity.z * extrapolationTime)
            };

            if (result.x !== NaN && result.y !== NaN && result.z !== NaN)
                return result;
            else
                return this.pinchPosCache[cacheLength - 1].position;
        }
        else
        {
            return this.pinchPosCache[cacheLength - 1].position;
        }
    }
}
