import {MediaPipeServiceProvider} from "./MediaPipeTracking.js";

import { updateRubberBand, updateDot,
         showHideBand, showHideDot, updateHands, 
         updateRender, showHidePanLine, updatePanLine, 
         showHideAll } from "./MediaPipeTinyHandGraphics.js";
import { BodySpaceToScreenSpacePoint } from "../components/mediapipe-tracking/processors/MediaPipeBodyPoseProcessor.js";
import {HideHelp, HideSearching, ShowHelp, ShowSearching} from "./TutorialHelp.js";

const MISSING = 0;
const VISIBLE = 1;
const POINTING = 2;
const PINCHING = 3;
const RESET = 4;
const LEFT = 0;

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let xScale = windowWidth ;
let yScale = windowHeight ;

let persistentHands = [{
    eventProps: {
        pointerId: 0,
        bubbles: true,
        isPrimary: true,
        width: 10,
        height: 10,
        clientX: 300,
        clientY: 300,
        pointerType: "touch",
    },
    tinyHand: {
        pinchPosition: {},
        fingers: [],
        state: MISSING,
        pinchID: -1,
        chirality: LEFT
    },
    touching: false,
    downPos: {x:0, y:0},
    activeElement: null,
    focusableParent: null,
    headFocusedElement: null
}, 
{
    eventProps: {
        pointerId: 0,
        bubbles: true,
        isPrimary: true,
        width: 10,
        height: 10,
        clientX: 300,
        clientY: 300,
        pointerType: "touch",
    },
    tinyHand: {
        pinchPosition: {},
        fingers: [],
        state: MISSING,
        pinchID: -1,
        chirality: LEFT
    },
    touching: false,
    downPos: {x:0, y:0},
    activeElement: null,
    focusableParent: null,
    headFocusedElement: null
}];

let mpServiceProvider;
let mpEventData = null;

// These are used for tutorial help video widget
let videoCanvas = null;
let destinationCtx = null;

if (MediaPipeServiceProvider !== null && MediaPipeServiceProvider != undefined) {
    InitialiseHands();
}
else {
    // Wait until the mediapipe-tracking component has been created,
    window.addEventListener("OnMPServiceInitialized", () => { InitialiseHands(); });
}

function InitialiseHands() {
    if (MediaPipeServiceProvider !== null && MediaPipeServiceProvider != undefined) {
        mpServiceProvider = MediaPipeServiceProvider;
        videoCanvas = document.querySelector('.video');
        if (videoCanvas != null) {
            destinationCtx = videoCanvas.getContext('2d');
        }

        ShowHelp();
        mpServiceProvider.eventDispatcher.addEventListener("OnMPNoActivePerson", (eventData) => {
            HideSearching();
            ShowHelp();
        });

        mpServiceProvider.eventDispatcher.addEventListener("OnMPFrame", (eventData) => {
            const activePerson = eventData.detail.activePerson;
            mpEventData = activePerson;

            if (mpEventData != null && mpEventData.body !== undefined && mpEventData.body !== null)
            {
                switch(mpEventData.body.poseData.poseState)
                {
                    case "MISSING":
                        HideSearching();
                        break;
                    case "BODY_VISIBLE":
                    case "HAND_VISIBLE":
                        break;
                    case "IN_SHOULDER_RECT":
                        HideHelp();
                        if (mpEventData.hands !== undefined && mpEventData.hands !== null)
                        {
                            const pinchPositionsBSS = GetPinchesInScreenSpace(mpEventData.hands.mpEvents.pinchPositions, mpEventData.body.poseData);
                            // Make Data Received go into persistentHands...
                            updateHands(pinchPositionsBSS, mpEventData.hands.mpEvents.tinyHands);
                            updateRender();
                            UpdatePointers(pinchPositionsBSS, mpEventData);
                        }
                    break;
                }
            }
            else
            {
                let personA = eventData.detail.people[0];
                let personB = eventData.detail.people[1];
                let person = personA.body.poseData.poseState != "MISSING" ? personA : personB;

                if (person != undefined && person.body != 0)
                {
                    switch(person.body.poseData.poseState)
                    {
                        case "MISSING":
                            HideSearching();
                            break;
                        case "BODY_VISIBLE":
                        case "HAND_VISIBLE":
                        case "IN_SHOULDER_RECT":
                            ShowSearching();
                            break;
                    }
                }
                showHideAll(false);
            }
            if (destinationCtx != null){
                let imageObj = mpServiceProvider.lastImage;
                destinationCtx.drawImage(imageObj, 0, 0, imageObj.videoWidth, imageObj.videoHeight, 0, 0, videoCanvas.width, videoCanvas.height);
            }
        });
    }
}

function UpdatePointers(pinchPositionsSS = null, eventData)
{    
    switch (eventData.hands.mpEvents.userState)
    {
        case MISSING:
            showHideAll(false);
            break;

        case VISIBLE:
            UpdateOverlayGraphics([]);
            break;

        case POINTING:             
            break;

        case PINCHING:
            let pinchPositions = [];
            
            for (let i = 0; i < 2; i++)
            {
                if (eventData.hands.mpEvents.tinyHands[i].state == PINCHING)
                {
                    persistentHands[i].eventProps.pointerId = eventData.hands.mpEvents.tinyHands[i].pinchID;
                    persistentHands[i].eventProps.isPrimary = eventData.hands.mpEvents.tinyHands[i].pinchID == 0;
                    pinchPositions.push(pinchPositionsSS[i]);
                }
            }
            UpdateOverlayGraphics(pinchPositions, persistentHands);
            break;

        case RESET:
            showHideAll(false);
            break;
    }
    if (eventData.hands.mpEvents.tinyHands != undefined)
    {
        persistentHands[0].tinyHand = eventData.hands.mpEvents.tinyHands[0];
        persistentHands[1].tinyHand = eventData.hands.mpEvents.tinyHands[1];
    }
}


window.addEventListener('resize', () => {
    xScale = window.innerWidth ;
    yScale = window.innerHeight ;
});

function GetPinchesInScreenSpace(pinchPositionsWS, bodyPoseData)
{
    let ssPositions = [];
    if (pinchPositionsWS != undefined)
    {
        for(let h = 0; h < pinchPositionsWS.length; h++)
        {
            if (pinchPositionsWS[h] == undefined){
                break;
            }
            const shoulderRect = bodyPoseData.shoulderRects[h+1] != null ? bodyPoseData.shoulderRects[h+1] : bodyPoseData.shoulderRects[0];
            const wsPoint = { x: pinchPositionsWS[h].x, y: pinchPositionsWS[h].y };
            let point = BodySpaceToScreenSpacePoint(wsPoint, shoulderRect, xScale, yScale);
            
            point.x = point.x - (xScale / 2);
            point.y = yScale - point.y - (yScale / 2);
            point.z = 0;
            ssPositions.push(point);
        }
    }
    
    return ssPositions;
}

function UpdateOverlayGraphics(pinchPositions, hands = null)
{
    // Default to always showing the rubber band behaviour...
    let shouldShowRubberBands = true;

    if (pinchPositions.length == 2)
    {
        showHideBand(true);
        showHideDot(false);
        showHidePanLine(false);
        // Only update the Rubber band if both hands started pinch move in the same div.
        if (shouldShowRubberBands){
            updateRubberBand(pinchPositions);
        }
        else {
            // Force Hide the band...
            showHideBand(false);
        }
    }
    else if (pinchPositions.length == 1)
    {
        showHideBand(false);
        showHideDot(true);
        updateDot(pinchPositions[0]);
        updatePanLine(pinchPositions[0]);
    }
    else
    {
        showHideBand(false);
        showHideDot(false);
        showHidePanLine(false);
    }
}
