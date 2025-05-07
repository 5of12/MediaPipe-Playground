import {MEDIAPIPE_TRACKING_DIV_NAME, MediaPipeServiceProvider} from "./MediaPipeTracking.js";
import { updateHands, updateRender, showHideAll, handScale } from "./MediaPipeTinyHandGraphics.js";
import { GetPinchesInScreenSpace, GetClientXY } from "./InputUtilities.js";
import {HideHelp, HideSearching, ShowHelp, ShowSearching} from "./TutorialHelp.js";

const MISSING = 0;
const VISIBLE = 1;
const POINTING = 2;
const PINCHING = 3;
const RESET = 4;

const mousePointerId = 1;
const clickRadius = 60;

let mouseEventProps = { bubbles: true, cancelable: true, clientX: 0, clientY: 0 };
let activeElement = null;
let activePinch = -1;

let persistentHands = [{
    eventProps: { bubbles: true, width: 10, height: 10, clientX: 0, clientY: 0, pointerType: "mouse" },
    tinyHand: null,
    touching: false,
    downPos: {x:0, y:0},
    activeElement: null,
}, 
{
    eventProps: { bubbles: true, width: 10, height: 10, clientX: 0, clientY: 0, pointerType: "mouse" },
    tinyHand: null,
    touching: false,
    downPos: {x:0, y:0},
    activeElement: null,
}];

let mpServiceProvider;
let mpEventData = null;

// Wait until the mediapipe-tracking component has been initialised, then setup...
window.addEventListener("OnMPServiceInitialized", () => {
    if (MediaPipeServiceProvider !== null) {
        mpServiceProvider = MediaPipeServiceProvider;
        let videoCanvas = document.querySelector('.video');
        let destinationCtx = videoCanvas.getContext('2d');

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

            let imageObj = mpServiceProvider.lastImage;
            destinationCtx.drawImage(imageObj, 0, 0, imageObj.videoWidth, imageObj.videoHeight, 0, 0, videoCanvas.width, videoCanvas.height);
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
            break;

        case POINTING:
            let index = eventData.hands.mpEvents.tinyHands[0].state == POINTING ? 0 : 1;
            SendMouseMoveEvent(eventData.hands.mpEvents.tinyHands[index], pinchPositionsSS[index]);                
            break;

        case PINCHING:
            let pinchPositions = [];
            
            for (let i = 0; i < 2; i++)
            {
                if (eventData.hands.mpEvents.tinyHands[i].state == PINCHING)
                {
                    persistentHands[i].eventProps.pointerId = eventData.hands.mpEvents.tinyHands[i].pinchID;
                    persistentHands[i].eventProps.isPrimary = eventData.hands.mpEvents.tinyHands[i].pinchID == 0;
                    if (persistentHands[i].touching != true && activePinch == -1 && 
                        pinchPositionsSS[i] != undefined && pinchPositionsSS.length != 0) 
                    {
                        SendPointerEvent('pointerdown', persistentHands[i], GetClientXY(pinchPositionsSS[i]));
                        persistentHands[i].touching = true;
                        activePinch = i;
                        return;
                    }
                    else if (activePinch == i)
                    {
                        SendPointerEvent('pointermove', persistentHands[i], GetClientXY(pinchPositionsSS[i]));
                    }
                    pinchPositions.push(pinchPositionsSS[i]);
                }
            }
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

// Pointer Event Handling - A single pointer event of type mouse is used to emulate a left click

function SendPointerEvent(eventType, hand, pinchPositionSS)
{
    if (pinchPositionSS == undefined){
        return;
    }
    hand.eventProps.movementX = pinchPositionSS.x - mouseEventProps.clientX;
    hand.eventProps.movementY = pinchPositionSS.y - mouseEventProps.clientY;
    hand.eventProps.clientX = pinchPositionSS.x;
    hand.eventProps.clientY = pinchPositionSS.y;
    hand.eventProps.pointerId = mousePointerId;

    let elements = document.elementsFromPoint(mouseEventProps.clientX, mouseEventProps.clientY);
    let topElement = elements[0] != undefined ? elements[0] : document.body;
    activeElement = topElement;

    if (eventType == 'pointerdown')
    {
        hand.downPos = {x: hand.eventProps.clientX, y: hand.eventProps.clientY };
    }

    let mouseEvent = new PointerEvent(eventType, hand.eventProps);
    topElement.dispatchEvent(mouseEvent);
}

function ClearPointers()
{
    for (let h = 0; h < 2; h++)
    {
        if (persistentHands[h].touching == true){
            if (persistentHands[h].eventProps.pointerId == 0 &&
                Math.abs(persistentHands[h].eventProps.clientX - persistentHands[h].downPos.x) < clickRadius && 
                Math.abs(persistentHands[h].eventProps.clientY - persistentHands[h].downPos.y) < clickRadius)
            {
                SendPointerEvent('pointercancel', persistentHands[h], persistentHands[h].downPos);
                SendClickEvent(persistentHands[h].downPos, activeElement);
            }
            else
            {
                SendPointerEvent('pointerup', persistentHands[h], persistentHands[h].downPos);
            }    

        } 
        persistentHands[h].touching = false;
    }
    activePinch = -1;
}

// Mouse Event Handling - For triggering element hover and default click behaviour

function SendClickEvent(position, element)
{
    mouseEventProps.clientX = position.x;
    mouseEventProps.clientY = position.y;
    let clickEvent = new MouseEvent('click', mouseEventProps);
    element.dispatchEvent(clickEvent);
}

function SendMouseMoveEvent(hand, pinchPositionsSS){
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