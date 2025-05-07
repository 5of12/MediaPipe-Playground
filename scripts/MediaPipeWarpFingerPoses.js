import {MEDIAPIPE_TRACKING_DIV_NAME, MediaPipeServiceProvider} from "./MediaPipeTracking.js";
import { Starfield } from './starfield.js';

const colour5of12 = [
    'rgb(255, 116, 119)',
    'rgb(255, 170, 82)',
    'rgb(255, 231, 122)',
    'rgb(173, 242, 156)',
    'rgb(119, 218, 201)',
    ]
const colours = [ colour5of12[0], colour5of12[1], colour5of12[2], colour5of12[3], colour5of12[4] ];

let starFieldStates = [{
    // Default values
    numStars: 250,                    // Number of stars
    baseSpeed: 5,                     // Base speed of stars (will affect acceleration)
    trailLength: 0.8,                 // Length of star trail (0-1)
    starColor: colour5of12[0],  // Color of stars (only rgb)
    canvasColor: 'rgb(0, 0, 0)',      // Canvas background color (only rgb)
    hueJitter: 0,                     // Maximum hue variation in degrees (0-360)
    maxAcceleration: 10,              // Maximum acceleration
    accelerationRate: 0.2,            // Rate of acceleration
    decelerationRate: 0.2,            // Rate of deceleration
    minSpawnRadius: 80,               // Minimum spawn distance from origin
    maxSpawnRadius: 500,              // Maximum spawn distance from origin
},
    {
        baseSpeed: 5,
        starColor : colour5of12[1]
    },
    {
        baseSpeed: 5,
        starColor : colour5of12[2]
    },
    {
        baseSpeed: 5,
        starColor : colour5of12[3]
    },
    {
        baseSpeed: 5,
        starColor : colour5of12[4]
    }
]

function decelerateAfterTimeout() {
    Starfield.setAccelerate(false);
}

function setStarfieldDefault(){
    Starfield.setup(starFieldStates[0]);
}

function setStarfieldState(state){
    let options = starFieldStates[state];
    Starfield.config.baseSpeed = options.baseSpeed;
    Starfield.config.starColor = options.starColor;
    PlayWarpAudioForPose(state);
    Starfield.setAccelerate(true);
    setTimeout(decelerateAfterTimeout, 1000); // executes the greet function after 2 seconds
}

window.onload = () => {
    setStarfieldDefault();
}

const oneOutlineImg = new URL("../media/Icons/OneOutlineShadow.png", import.meta.url).href;
const twoOutlineImg = new URL("../media/Icons/TwoOutlineShadow.png", import.meta.url).href;
const threeOutlineImg = new URL("../media/Icons/ThreeOutlineShadow.png", import.meta.url).href;
const fourOutlineImg = new URL("../media/Icons/FourOutlineShadow.png", import.meta.url).href;
const fiveOutlineImg = new URL("../media/Icons/FiveOutlineShadow.png", import.meta.url).href;
const oneColorImg = new URL("../media/Icons/OneFingerRed.png", import.meta.url).href;
const twoColorImg = new URL("../media/Icons/TwoFingerOrange.png", import.meta.url).href;
const threeColorImg = new URL("../media/Icons/ThreeFingerYellow.png", import.meta.url).href;
const fourColorImg = new URL("../media/Icons/FourFingerGreen.png", import.meta.url).href;
const fiveColorImg = new URL("../media/Icons/FiveFingerBlue.png", import.meta.url).href;

const warp0sound = new URL("../media/audio/warp0.m4a", import.meta.url).href;
const warp1sound = new URL("../media/audio/warp1.m4a", import.meta.url).href;
const warp2sound = new URL("../media/audio/warp2.m4a", import.meta.url).href;
const warp3sound = new URL("../media/audio/warp3.m4a", import.meta.url).href;
const warp4sound = new URL("../media/audio/warp4.m4a", import.meta.url).href;
const wakeSound = new URL("../media/audio/wake.m4a", import.meta.url).href;
const sleepSound = new URL("../media/audio/sleep.m4a", import.meta.url).href;

const warpSounds = [warp0sound, warp1sound, warp2sound, warp3sound, warp4sound];
const viewIconsWhite = [ oneOutlineImg, twoOutlineImg, threeOutlineImg, fourOutlineImg, fiveOutlineImg];
const viewIconsColour = [ oneColorImg, twoColorImg, threeColorImg, fourColorImg, fiveColorImg];


let activeImage = 0;
let nextImage = 0;
let handsLostTimeoutMS = 3000; //60000;
const resetOnTimeout = true;
let lastHandDataTime = 0;
let startTime = 0;
let completedTime = 0;

let persistentHands =
[{
    tinyHand: {
        gestureState: "NONE",
        gestureProgress: 0
    },
},
    {
    tinyHand: {
        gestureState: "NONE"
    },
    handsPresent: false,
    gestureProgress: 0
}];

let helpOverlay;
let iconOverlay;
let iconDivs = [];
let iconImages = [];

let progressAngleA;
let progressAngleB;
let progressTimeMS = 1500;

// AUDIO
var audio = document.createElement("AUDIO");
let muteSwitch = document.querySelector("#checkboxInput");
muteSwitch.onclick = () => {
    MuteSwitchToggled();
}

audio.volume = 0.2;

function MuteSwitchToggled()
{
    audio.muted = muteSwitch.checked;
}

function PlayWarpAudioForPose(state){
    let src = warpSounds[state];
    audio.src = src;
    audio.play();
}

function PlayWakeAudio(){
    let src = wakeSound;
    audio.src = src;
    audio.play();
}

function PlaySleepAudio(){
    let src = sleepSound;
    audio.src = src;
    audio.play();
}

let mpServiceProvider;
// Wait until the mediapipe-tracking component has been initialised, then setup...
window.addEventListener("OnMPServiceInitialized", () => {
    helpOverlay = document.querySelector(".starfield-origin");
    iconOverlay = document.querySelector(".iconOverlay");
    iconDivs = document.querySelectorAll(".viewIcons");
    iconImages = document.querySelectorAll(".viewIcon");
    UpdateViewIcons(0);

    ShowHelp();

    // Initially hide the icons until a hand is present...
    HideShortcutsView();
    if (MediaPipeServiceProvider !== null) {
        // We don't need the Hand Tracker is setup to check finger poses...
        mpServiceProvider = MediaPipeServiceProvider;
        let videoCanvas = document.querySelector('.starfield-video-canvas');
        let destinationCtx = videoCanvas.getContext('2d');

        mpServiceProvider.eventDispatcher.addEventListener("OnMPNoActivePerson", (eventData) => {
            HideShortcutsView();
        });

        //copy the data
        mpServiceProvider.eventDispatcher.addEventListener("OnMPFrame", (eventData) => {
                const activePerson = eventData.detail.activePerson;
                if (activePerson != null && activePerson.body.poseData.poseState == "IN_SHOULDER_RECT")
                {
                    if (activePerson.hands !== undefined && activePerson.hands !== null) {
                        UpdateGestures(activePerson.hands, activePerson.body.poseData.handInRectChirality);
                        let timestamp = Date.now();
                        if (persistentHands.handsPresent) {
                            lastHandDataTime = timestamp;
                        } else if (resetOnTimeout && activeImage != 0 && timestamp - lastHandDataTime > handsLostTimeoutMS) {
                            HideActiveViewHand();
                            activeImage = 0;
                            ShowActiveViewHand();
                        }
                    }
                }
                else
                {
                    ClearAllIconAnimation();
                }
                //HTMLVideoElement
                let imageObj = mpServiceProvider.lastImage;
                destinationCtx.drawImage(imageObj, 0, 0, imageObj.videoWidth, imageObj.videoHeight, 0, 0, videoCanvas.width, videoCanvas.height);
            });
    }
});

// Functional processing of the event for pose detection
function UpdateGestures(hands, activeChirality)
{
    persistentHands[0].tinyHand = hands.mpEvents.tinyHands[0];
    persistentHands[1].tinyHand = hands.mpEvents.tinyHands[1];

    let activeHand = null;
    if (persistentHands[0].tinyHand.state != 0 && persistentHands[0].tinyHand.state != 4 && persistentHands[0].tinyHand.chirality == activeChirality)
    {
        activeHand = persistentHands[0].tinyHand;
        persistentHands.handsPresent = true;
    }
    else if (persistentHands[1].tinyHand.state != 0 && persistentHands[1].tinyHand.state != 4 && persistentHands[1].tinyHand.chirality == activeChirality)
    {
        activeHand = persistentHands[1].tinyHand;
        persistentHands.handsPresent = true;
    }
    else
    {
        persistentHands.handsPresent = false;
    }

    if (activeHand == null){
        ClearAllIconAnimation();
        return;
    }
    else
    {
        ShowShortcutsView();
    }

    switch(activeHand.gestureState)
    {
        case "":
            nextImage = 0;
            break;
        case "NONE":
            nextImage = 0;
            startTime = Date.now();
            if (startTime - completedTime > progressTimeMS)
            {
                ClearAllIconAnimation();
            }
            break;
        case "ONE":
            nextImage = 0;
            ShowActiveViewHand();
            UpdateIconVisuals(nextImage);
            break;
        case "TWO":
            nextImage = 1;
            ShowActiveViewHand();
            UpdateIconVisuals(nextImage);
            break;
        case "THREE":
            nextImage = 2;
            ShowActiveViewHand();
            UpdateIconVisuals(nextImage);
            break;
        case "FOUR":
            nextImage = 3;
            ShowActiveViewHand();
            UpdateIconVisuals(nextImage);
            break;
        case "FIVE":
            nextImage = 4;
            ShowActiveViewHand();
            UpdateIconVisuals(nextImage);
            break;
        case "CONFIRM":
            HideActiveViewHand();

            if (activeImage != nextImage){
                setStarfieldState(nextImage);
            }
            activeImage = nextImage;
            completedTime = Date.now();
            UpdateIconVisuals(nextImage);
            UpdateViewIcons(nextImage);
            ShowActiveViewHand();
            break;
    }
}

function ShowShortcutsView()
{
    if (iconOverlay.classList.contains("minimise"))
    {
        console.log("SetOverlayVisible");  //<- This should not be being called repeatedly
        iconOverlay.classList.remove("minimise");
        iconOverlay.classList.add("maximise");
        PlayWakeAudio();
        HideHelp();
    }
}

function HideShortcutsView(){

    if (iconOverlay.classList.contains("maximise"))
    {
        console.log("HideShortcutsView");
        iconOverlay.classList.remove("maximise");
        iconOverlay.classList.add("minimise");
        PlaySleepAudio();
        ShowHelp();
    }
}

function ShowHelp(){
    if (helpOverlay.classList.contains("hidden"))
    {
        helpOverlay.classList.remove("hidden");
        helpOverlay.classList.add("visible");
    }
}

function HideHelp(){
    if (helpOverlay.classList.contains("visible"))
    {
        helpOverlay.classList.remove("visible");
        helpOverlay.classList.add("hidden");
    }
}

function UpdateIconVisuals(nextImage)
{
    for(let i = 0 ; i < iconDivs.length; i++)
    {
        if (i == nextImage)
        {
            if (nextImage != activeImage)
            {
                if (!iconDivs[i].classList.contains("selectedIcon"))
                {
                    iconDivs[i].classList.add("selectedIcon");
                }

                AnimateIconProgress(iconDivs[i], startTime, Date.now(), progressTimeMS, colours[i]);
            }
            else
            {
                AnimateIconProgress(iconDivs[i], startTime, 1, 1, colours[i]);
            }
        }
        else
        {
            ClearIconAnimation(iconDivs[i]);
        }
    }
}

function AnimateIconProgress(element, startTime, currentTime, length, color)
{
    let normTime = Math.min(currentTime - startTime, length) / length;

    progressAngleA = (normTime * 360).toString() + 'deg';
    progressAngleB = ((normTime * 360) + 1).toString() + 'deg';

    element.style.setProperty('--gradAngleA', progressAngleA);
    element.style.setProperty('--gradAngleB', progressAngleB);
    element.style.setProperty('--color', color);
}

function ClearAllIconAnimation()
{
    iconDivs.forEach(div => {
        ClearIconAnimation(div);
    });
}

function ClearIconAnimation(element)
{
    element.style.setProperty('--gradAngleA', 0);
    element.style.setProperty('--gradAngleB', 0);

    if (element.classList.contains("selectedIcon"))
        element.classList.remove("selectedIcon");
}

function UpdateViewIcons(activeImage)
{
    for (let i = 0; i < iconImages.length; i++)
    {
        iconImages[i].src = i == activeImage ? viewIconsColour[i] : viewIconsWhite[i];
    }
}

function ShowActiveViewHand()
{
    if (!iconDivs[activeImage].classList.contains("activeIcon"))
    {
        iconDivs[activeImage].classList.add("activeIcon");
        iconDivs[activeImage].style.setProperty('--color', colours[activeImage]);
    }
}

function HideActiveViewHand()
{
    if (iconDivs[activeImage].classList.contains("activeIcon"))
    {
        iconDivs[activeImage].classList.remove("activeIcon");
    }
}