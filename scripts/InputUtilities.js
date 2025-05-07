import { BodySpaceToScreenSpacePoint, BodySpaceToViewSpacePoint } from "../components/mediapipe-tracking/processors/MediaPipeBodyPoseProcessor.js";

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let xScale = windowWidth ;
let yScale = windowHeight ;

window.addEventListener('resize', () => {
    xScale = window.innerWidth ;
    yScale = window.innerHeight ;
});

export function GetPinchesInScreenSpace(pinchPositionsWS, bodyPoseData)
{
    let ssPositions = [];
    if (pinchPositionsWS != undefined)
    {
        for(let h = 0; h < pinchPositionsWS.length; h++)
        {
            if (pinchPositionsWS[h] != undefined){
                
                const shoulderRect = bodyPoseData.shoulderRects[h+1] != null ? bodyPoseData.shoulderRects[h+1] : bodyPoseData.shoulderRects[0];
                const wsPoint = { x: pinchPositionsWS[h].x, y: pinchPositionsWS[h].y };
                
                let point = BodySpaceToScreenSpacePoint(wsPoint, shoulderRect, xScale, yScale);
                point.x = point.x - (xScale / 2);
                point.y = yScale - point.y - (yScale / 2);
                point.z = 0;
                
                ssPositions.push(point);
            }
        }
    }
    
    return ssPositions;
}

export function GetClientXY(pointerPosition)
{
    let pointerX = pointerPosition.x;
    let pointerY = pointerPosition.y;

    return { x: pointerX + (xScale / 2), 
             y: yScale - (pointerY + (yScale / 2))};
}