import {MediaPipeHeadDirectionDetector} from "../detectors/MediaPipeHeadDirectionDetector.js";
export const PoseStates = { MISSING: "MISSING",  BODY_VISIBLE: "BODY_VISIBLE", HAND_VISIBLE: "HAND_VISIBLE", IN_SHOULDER_RECT: "IN_SHOULDER_RECT" };
const keyLandmarks = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
}

export class MPBodyPose
{
    constructor(landmarks = null, checkHeadTurn = false)
    {
        this.poseData = this.EmptyPoseData();
        this.pinchDeadzoneRadiusPx = 50;
        this.handLerpSpeed = 0.4;

        this.checkHeadTurn = checkHeadTurn;
        if (this.checkHeadTurn){
            this.headTurnDetector = new MediaPipeHeadDirectionDetector();
        }

        if (landmarks != null)
        {
            // This was never getting called?
            //this.Update(landmarks);
            if (this.checkHeadTurn){
                console.log("Creating a MediaPipeHeadDirectionDetector...")
            }
        }
    }

    EmptyPoseData()
    {
        return {
            poseLandmarks: null,
            leftShoulder: {x:0, y:0},
            rightShoulder: {x:0, y:0},
            leftHand: null,
            rightHand: null,
            shoulderRects: [null, null, null], // Three rects, neutral, left, right
            pinchPoints: [{x:0, y:0}, {x:0, y:0}], //Two pinch points for left/right hands
            poseState: PoseStates.MISSING,
            poseID: 0
        }
    }

    UpdateBodyHandsFromResults(landmarks, screenWidth, screenHeight)
    {
        // If the shoulders are detected, create a rect around the shoulders
        let shoulderRect = null;
        let paddedShoulderRect = null;
        let leftShoulderRect = null;
        let rightShoulderRect = null;
        let pinchPointL = { x: 0, y: 0 };
        let pinchPointR = { x: 0, y: 0 };

        // This is a count of the number of Body pose hand features (wrists), inside the shoulder rect...
        let handsInRect = 0;
        let handInRectChirality = "None";

        let state = PoseStates.MISSING;

        if (landmarks) {
            const rightShoulder = landmarks[keyLandmarks.RIGHT_SHOULDER];
            const leftShoulder = landmarks[keyLandmarks.LEFT_SHOULDER];
            
            if (leftShoulder && rightShoulder) {
                let deadZoneRadius = Math.abs(this.poseData.rightShoulder.x - this.poseData.leftShoulder.x) * 0.2;
                this.poseData.leftShoulder = DeadzonePosition(this.poseData.leftShoulder, leftShoulder, deadZoneRadius);
                this.poseData.rightShoulder = DeadzonePosition(this.poseData.rightShoulder, rightShoulder, deadZoneRadius);

                let rectWidth = Math.abs(this.poseData.rightShoulder.x - this.poseData.leftShoulder.x);
                let rectHeight = rectWidth;
                const padding = 0.4 * rectWidth;
                const offsetRectScale = 1.6;
                state = PoseStates.BODY_VISIBLE;


                shoulderRect = {
                    x: this.poseData.rightShoulder.x,
                    y: this.poseData.rightShoulder.y - (rectHeight * 0.25),
                    width: rectWidth,
                    height: rectHeight
                };

                paddedShoulderRect = {
                    x: shoulderRect.x - padding * 1.5,
                    y: shoulderRect.y - padding,
                    width: shoulderRect.width + (padding * 3),
                    height: shoulderRect.height + (padding * 2)
                }

                // Check if the hands are in the shoulder rect
                const leftHand = landmarks[keyLandmarks.LEFT_WRIST];
                if (leftHand.visibility > 0.8)
                {
                    state = PoseStates.HAND_VISIBLE;
                    const previousLeft = this.poseData.leftHand ? this.poseData.leftHand : leftHand;
                    const smoothLeft = LerpPosition(previousLeft, leftHand, this.handLerpSpeed);

                    if (PointInsideRect(smoothLeft, paddedShoulderRect)) 
                    {
                        state = PoseStates.IN_SHOULDER_RECT;
                        handsInRect++;
                        handInRectChirality = "Left";
                        leftShoulderRect = GetOffsetShoulderRect(shoulderRect, padding / 4, offsetRectScale);

                        pinchPointL = BodySpaceToScreenSpacePoint(smoothLeft, leftShoulderRect, screenWidth, screenHeight);
                        this.poseData.leftHand = {x: smoothLeft.x, y: smoothLeft.y, z: smoothLeft.z };
                    }
                }
                else
                {
                    this.poseData.leftHand = null;
                }
                
                const rightHand = landmarks[keyLandmarks.RIGHT_WRIST];
                if (rightHand.visibility > 0.8)
                {
                    if (state != PoseStates.IN_SHOULDER_RECT) state = PoseStates.HAND_VISIBLE;
                    const previousRight = this.poseData.rightHand ? this.poseData.rightHand : rightHand;
                    const smoothRight = LerpPosition(previousRight, rightHand, this.handLerpSpeed);

                    if (PointInsideRect(smoothRight, paddedShoulderRect))
                    {
                        state = PoseStates.IN_SHOULDER_RECT;
                        handsInRect++;
                        handInRectChirality = "Right";
                        rightShoulderRect = GetOffsetShoulderRect(shoulderRect, -padding / 4, offsetRectScale);

                        pinchPointR = BodySpaceToScreenSpacePoint(smoothRight, rightShoulderRect, screenWidth, screenHeight);
                        this.poseData.rightHand = {x: smoothRight.x, y: smoothRight.y, z: smoothRight.z };
                    }
                }
                else
                {
                    this.poseData.rightHand = null;
                }


                const prevPinchPoints = [ this.poseData.pinchPoints[0], this.poseData.pinchPoints[1]  ];

                this.poseData.poseLandmarks = landmarks;
                this.poseData.shoulderRects[0] = paddedShoulderRect;
                this.poseData.shoulderRects[1] = leftShoulderRect ? leftShoulderRect : null;
                this.poseData.shoulderRects[2] = rightShoulderRect ? rightShoulderRect : null;
                this.poseData.pinchPoints[0] = leftShoulderRect ? DeadzonePosition(this.poseData.pinchPoints[0], pinchPointL, this.pinchDeadzoneRadiusPx) : this.poseData.pinchPoints[0];
                this.poseData.pinchPoints[1] = rightShoulderRect ? DeadzonePosition(this.poseData.pinchPoints[1], pinchPointR, this.pinchDeadzoneRadiusPx) : this.poseData.pinchPoints[1];
                this.poseData.handsInRect = handsInRect;
                this.poseData.handInRectChirality = handsInRect == 2 ? "Both" : handInRectChirality ;
                const pinchDeltas = [Math.abs(this.poseData.pinchPoints[0].y - prevPinchPoints[0].y), Math.abs(this.poseData.pinchPoints[1].y - prevPinchPoints[1].y)];
                this.poseData.movementState = pinchDeltas[0] < this.pinchDeadzoneRadiusPx * 1.1 && pinchDeltas[1] < this.pinchDeadzoneRadiusPx * 1.1 ? "STATIC" : "MOVING";
            }

            if (this.checkHeadTurn){
                this.poseData.headTurnYaw = this.headTurnDetector.GetHeadYaw(landmarks);
            }
        }

        if (state != this.poseData.poseState)
        {
            this.poseData.poseState = state;
        }

        return this.poseData;
    }   

    DrawDebugVisuals(canvasCtx, screenWidth, screenHeight)
    {
        if (this.poseData.shoulderRects[0] != null) DrawRect(canvasCtx, this.poseData.shoulderRects[0], 'yellow', 5, screenWidth, screenHeight);
        if (this.poseData.shoulderRects[1] != null) DrawRect(canvasCtx, this.poseData.shoulderRects[1], 'rgb(0,217,231)', 10, screenWidth, screenHeight);
        if (this.poseData.shoulderRects[2] != null) DrawRect(canvasCtx, this.poseData.shoulderRects[2], 'rgb(255,138,0)', 10, screenWidth, screenHeight);
        if (this.poseData.poseState == PoseStates.IN_SHOULDER_RECT)
        {
            DrawCursor(canvasCtx, this.poseData.pinchPoints[0], 5, 'rgb(0,217,231)');
            DrawCursor(canvasCtx, this.poseData.pinchPoints[1], 5, 'rgb(255,138,0)');
        }
    }
}


// Helper functions
function LerpPosition(start, end, time)
{
    const minusT = 1 - time;
    return {
        x: (minusT * start.x) + (time * end.x),
        y: (minusT * start.y) + (time * end.y),
        z: (minusT * start.z) + (time * end.z)
    }
}

function PointInsideRect(point, rect)
{
    return point.x > rect.x && point.x < rect.x + rect.width &&
           point.y > rect.y && point.y < rect.y + rect.height;
}

export function BodySpaceToViewSpacePoint(bodyPoint, bodyRect)
{
    const normalisedPoint = {
        x: (bodyPoint.x - bodyRect.x) / bodyRect.width,
        y: (bodyPoint.y - bodyRect.y) / bodyRect.height
    };

    // Clamp to range 0 - 1
    normalisedPoint.x = 1 - Math.min(1, Math.max(0, normalisedPoint.x));
    normalisedPoint.y = Math.min(1, Math.max(0, normalisedPoint.y));

    return normalisedPoint;
}

export function BodySpaceToScreenSpacePoint(bodyPoint, bodyRect, screenWidth, screenHeight)
{
    // Normalise the body point within the body rect
    const normalisedPoint = {
        x: (bodyPoint.x - bodyRect.x) / bodyRect.width,
        y: (bodyPoint.y - bodyRect.y) / bodyRect.height
    };

    // Clamp to range 0 - 1
    normalisedPoint.x = 1 - Math.min(1, Math.max(0, normalisedPoint.x));
    normalisedPoint.y = Math.min(1, Math.max(0, normalisedPoint.y));

    // Convert the normalised point to screen space
    const screenSpacePoint = {
        x: normalisedPoint.x * screenWidth,
        y: normalisedPoint.y * screenHeight
    };

    return screenSpacePoint;
}

function GetOffsetShoulderRect(baseRect, offset, scale = 1)
{
    return { 
        x: baseRect.x + offset - (baseRect.width * (scale - 1) / 2), 
        y: baseRect.y - (baseRect.height * (scale - 1) / 2), 
        width: baseRect.width * scale, 
        height: baseRect.height * scale * 0.8};
}

function DrawRect(canvasCtx, rect, color, lineWidth, ssWidth, ssHeight)
{
    canvasCtx.save();
    canvasCtx.beginPath(); // Start a new path
    canvasCtx.rect(rect.x * ssWidth, rect.y * ssHeight, 
        rect.width * ssWidth, rect.height * ssHeight);
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.strokeStyle = color;
    canvasCtx.stroke(); // Render the path
    canvasCtx.restore();
}

function DrawCursor(canvasCtx, point, radius, color)
{
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.fillStyle = color;
    canvasCtx.strokeStyle = 'white';
    canvasCtx.lineWidth = radius * 0.5;
    canvasCtx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    canvasCtx.fill();
    canvasCtx.stroke();
    canvasCtx.restore();
}

function DeadzonePosition(oldPosition, newPosition, radius)
{
    if (oldPosition == undefined || newPosition == undefined) return { x: 0, y: 0, z: 0 };

    const dist = Math.sqrt(Math.pow(newPosition.x - oldPosition.x, 2) +
                           Math.pow(newPosition.y - oldPosition.y, 2));

    if (dist > radius)
    {
        let offset = {
            x: ((newPosition.x - oldPosition.x ) / dist) * radius,
            y: ((newPosition.y - oldPosition.y ) / dist) * radius,
        }

        let deadPos = {
            x: newPosition.x - offset.x,
            y: newPosition.y - offset.y
        }

        return { x: deadPos.x, y: deadPos.y };
    }
    else
    {
        return { x: oldPosition.x, y: oldPosition.y };
    }
}