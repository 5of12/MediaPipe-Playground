import {MEDIAPIPE_TRACKING_DIV_NAME, MediaPipeServiceProvider} from "./MediaPipeTracking.js";

import { updateRubberBand, updateDot,
         showHideBand, showHideDot, updateHands, 
         updateRender, showHidePanLine, updatePanLine, 
         showHideAll, handScale} from "./MediaPipeTinyHandGraphics.js";
import { BodySpaceToScreenSpacePoint, BodySpaceToViewSpacePoint } from "../components/mediapipe-tracking/processors/MediaPipeBodyPoseProcessor.js";
import {UpdateHeadFocus, ResetAllDivFocus} from "./MediaPipeHeadTurnDivFocuser.js";
import {HideHelp, HideSearching, ShowHelp, ShowSearching} from "./TutorialHelp.js";

const MISSING = 0;
const VISIBLE = 1;
const POINTING = 2;
const PINCHING = 3;
const RESET = 4;
const LEFT = 0;
const RIGHT = 1;

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
let xOffset = 0;

let xScale = windowWidth ;
let yScale = windowHeight ;
const clickRadius = 60;

// Find any Data Focusable elements
var focusableDivs = document.querySelectorAll('[data-zoomable]');
let activeView = null;
let checkHeadDivFocus = false;

let mouseEventProps =
    {
        pointerId: 0,
        bubbles: true,
        isPrimary: true,
        width: 100,
        height: 100,
        clientX: 300,
        clientY: 300,
        pointerType: 'mouse'
    };

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

// Wait until the mediapipe-tracking component has been created,
window.addEventListener("OnMPServiceInitialized", () => {
    if (MediaPipeServiceProvider !== null && MediaPipeServiceProvider != undefined) {
        mpServiceProvider = MediaPipeServiceProvider;
        videoCanvas = document.querySelector('.video');
        if (videoCanvas != null) {
            destinationCtx = videoCanvas.getContext('2d');
        }

        checkHeadDivFocus = mpServiceProvider.checkHeadTurn != undefined ? mpServiceProvider.checkHeadTurn : false;

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
                if (checkHeadDivFocus){
                    let focussedElement = UpdateHeadFocus(mpEventData, focusableDivs);
                    if (focussedElement != null){
                        persistentHands[0].headFocusedElement = focussedElement;
                        persistentHands[1].headFocusedElement = focussedElement;
                        xOffset = EvaluateXOffset();
                    }
                    else {
                        ResetAllDivFocus();
                        xOffset = 0;
                    }
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
});

function UpdatePointers(pinchPositionsSS = null, eventData)
{    
    switch (eventData.hands.mpEvents.userState)
    {
        case MISSING:
            ClearPointers();
            showHideAll(false);
            break;

        case VISIBLE:
            ClearPointers();
            
            UpdateOverlayGraphics([]);
            break;

        case POINTING:
            let index = eventData.hands.mpEvents.tinyHands[0].state == POINTING ? 0 : 1;
            HandlePointingHand(eventData.hands.mpEvents.tinyHands[index], pinchPositionsSS[index]);                
            break;

        case PINCHING:
            let pinchPositions = [];
            
            for (let i = 0; i < 2; i++)
            {
                if (eventData.hands.mpEvents.tinyHands[i].state == PINCHING)
                {
                    persistentHands[i].eventProps.pointerId = eventData.hands.mpEvents.tinyHands[i].pinchID;
                    persistentHands[i].eventProps.isPrimary = eventData.hands.mpEvents.tinyHands[i].pinchID == 0;
                    if (persistentHands[i].touching != true) 
                    {
                        SendPointerEvent('pointerdown', persistentHands[i], GetClientXY(pinchPositionsSS[i]));
                        return;
                    }
                    else 
                    {
                        SendPointerEvent('pointermove', persistentHands[i], GetClientXY(pinchPositionsSS[i]));
                    }
                    pinchPositions.push(pinchPositionsSS[i]);
                }
            }
            UpdateOverlayGraphics(pinchPositions, persistentHands);
            break;

        case RESET:
            ClearPointers();

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
            if (!checkHeadDivFocus && focusableDivs.length > 1)
            {
                const vsPoint = BodySpaceToViewSpacePoint(wsPoint, shoulderRect);
                point.x = SoftSnapXPosition(vsPoint, xScale) - (xScale / 2);
            }
            else
            {
                point.x = point.x - (xScale / 2);
            }
            point.x += xOffset;
            point.y = yScale - point.y - (yScale / 2);
            point.z = 0;
            ssPositions.push(point);
        }
    }
    
    return ssPositions;
}

function SoftSnapXPosition(point, windowWidth)
{
    // Pick a region to soft snap towards
    const rects = [ focusableDivs[0].getBoundingClientRect(), focusableDivs[1].getBoundingClientRect() ];
    const centreLinePx = ((rects[0].right + rects[1].left ) / 2);
    const centreLineRatio = centreLinePx / windowWidth;

    const softSnapAmount = 0.01;
    let posX;

    const pointXShifted = point.x;
    let linearPos;

    if (pointXShifted < 0.5)
    {
        const normX = pointXShifted * 2;
        linearPos = normX * centreLineRatio;
        posX = linearPos + (Math.sin(normX * Math.PI * 2) * softSnapAmount);
    }
    else
    {
        const normX = (pointXShifted - 0.5) * 3;
        linearPos = ((1 - normX) * centreLineRatio) + normX; 
        posX = linearPos + (Math.sin(normX * Math.PI * 2) * softSnapAmount);
    }
    return posX * windowWidth;
}

function EvaluateXOffset()
{
    let offset;
    if (persistentHands[0].headFocusedElement != null)
    {
        const rect = persistentHands[0].headFocusedElement.getBoundingClientRect();
        let centre = (rect.left + rect.right) / 2;
        offset = centre - (window.innerWidth / 2) * 0.5;
    }

    return offset;
}

function HandlePointingHand(hand, pinchPositionsSS){
    if (pinchPositionsSS == undefined || hand.pinchPosition == undefined){
        return;
    }
    let indexFingerTipWS = hand.fingers[1].joints[3];
    let pointFingerPos = {x:indexFingerTipWS.x - hand.pinchPosition.x,
                          y:indexFingerTipWS.y - hand.pinchPosition.y,
                          z:indexFingerTipWS.z - hand.pinchPosition.z}

    let pointPos = GetClientXY({x: handScale * pointFingerPos.x + pinchPositionsSS.x, 
                    y: -handScale * 0.5 * pointFingerPos.y + pinchPositionsSS.y});

    mouseEventProps.clientX = pointPos.x;
    mouseEventProps.clientY = pointPos.y;

    let elements = document.elementsFromPoint(mouseEventProps.clientX, mouseEventProps.clientY);
    let topElement = elements[0] != undefined ? elements[0] : document.body;

    let moveEvent = new MouseEvent('mousemove', mouseEventProps);
    topElement.dispatchEvent(moveEvent);
}

function GetClientXY(pointerPosition)
{
    let pointerX = pointerPosition.x;
    let pointerY = pointerPosition.y;

    return { x: pointerX + (xScale / 2), 
             y: yScale - (pointerY + (yScale / 2))};
}

function GetFocusableParentForElement(element){
    let parent = null;
    if (focusableDivs === undefined || focusableDivs.length === 0){
        return parent;
    }

    for (let i = 0; i < focusableDivs.length; i++){
        if (focusableDivs[i].contains(element)){
            parent = focusableDivs[i];
            SetViewFocused(parent);
            return parent;
        }
    }
    return parent;
}

function SetViewFocused(viewElement = null){
    activeView = viewElement;
}

function SendPointerEvent(eventType, handObject, pinchPosition)
{
    if (pinchPosition != null)
    {
        handObject.eventProps.movementX = pinchPosition.x - handObject.eventProps.clientX;
        handObject.eventProps.movementY = pinchPosition.y - handObject.eventProps.clientY;
        handObject.eventProps.clientX = pinchPosition.x;
        handObject.eventProps.clientY = pinchPosition.y;
    }

    if (eventType == 'pointerdown') 
    {
        handObject.touching = true;
        handObject.downPos = { x: handObject.eventProps.clientX, y: handObject.eventProps.clientY };
        handObject.eventProps.movementX = 0;
        handObject.eventProps.movementY = 0;
        
        let elements = document.elementsFromPoint(handObject.eventProps.clientX, handObject.eventProps.clientY);
        let topElement = elements[0] != undefined ? elements[0] : document.body;
        handObject.activeElement = topElement;

        // Determine the parent focusable div element (if any)
        handObject.focusableParent = GetFocusableParentForElement(handObject.activeElement);
    }
    let pointerEvent = new PointerEvent(eventType, handObject.eventProps);
    handObject.activeElement.dispatchEvent(pointerEvent);
}

function SendClickEvent(position, element)
{
    mouseEventProps.clientX = position.x;
    mouseEventProps.clientY = position.y;
    let moveEvent = new MouseEvent('click', mouseEventProps);
    element.dispatchEvent(moveEvent);
}

function ClearPointers()
{
    let emptyPointingPos = null;
    for (let h = 0; h < 2; h++)
    {
        if (persistentHands[h].touching == true){
            if (persistentHands[h].eventProps.pointerId == 0 &&
                Math.abs(persistentHands[h].eventProps.clientX - persistentHands[h].downPos.x) < clickRadius && 
                Math.abs(persistentHands[h].eventProps.clientY - persistentHands[h].downPos.y) < clickRadius)
            {
                SendPointerEvent('pointercancel', persistentHands[h], persistentHands[h].downPos);
                SendClickEvent(persistentHands[h].downPos, persistentHands[h].activeElement);
            }
            else
            {
                SendPointerEvent('pointerup', persistentHands[h], emptyPointingPos);
            }    
        } 
        persistentHands[h].touching = false;
    }

}

function UpdateOverlayGraphics(pinchPositions, hands = null)
{
    // Default to always showing the rubber band behaviour...
    let shouldShowRubberBands = true;

    // But if there's more than one focusable div...
    if (focusableDivs !== undefined && focusableDivs.length > 1){
        if (hands !== undefined && hands !== null && hands.length === 2 ) {
            let hand0Parent = hands[0].focusableParent;
            let hand1Parent = hands[1].focusableParent;
            // We need to check whether it supports zooming...
            shouldShowRubberBands = (hand0Parent === hand1Parent) && (hand0Parent != null) && (hand0Parent.dataset.zoomable.length > 0);
        }
    }
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
