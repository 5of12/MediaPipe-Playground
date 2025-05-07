import {MediaPipeServiceProvider} from "./MediaPipeServiceProvider.js";
const cssStyle = new URL('css/MediaPipe.css', import.meta.url).href
const controlPanelCSS = new URL('css/control_utils.css', import.meta.url).href
const peopleIndicatorStyle = new URL('css/PeopleIndicator.css', import.meta.url).href
const gearIcon = new URL('icons/gear.png', import.meta.url).href
const inactivePersonIcon = new URL("./icons/PersonInactive.png", import.meta.url).href;

const template = document.createElement('template');

template.innerHTML = `
<link rel="stylesheet" href="${cssStyle}">
<link rel="stylesheet" href="${controlPanelCSS}">
<!--<video class="mp-input-video"></video>-->
<canvas class="mp-video-canvas"></canvas>
<canvas class="mp-hands-overlay-canvas"></canvas>
<canvas class="mp-body-overlay-canvas"></canvas>
<div class="loading">
    <div class="spinner"></div>
    <div class="message">
        Loading
    </div>
</div>
<div class="control-panel" style="visibility: hidden "></div>
<button class="controlPanelToggleBtn"></button>

<link rel="stylesheet" href="${peopleIndicatorStyle}"></link>

<people-indicator>
<div id="peopleIndicator" class="peopleContainer">
    <image class="personIcon" src="${inactivePersonIcon}"></image>  
    <image class="personIcon" src="${inactivePersonIcon}"></image>
</div>
</people-indicator>
`

export class MediaPipeTrackingControls extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        let controlPanelToggle = this.shadowRoot.querySelector('.controlPanelToggleBtn');
        controlPanelToggle.style.backgroundImage = "url('" + gearIcon + "')";
        controlPanelToggle.addEventListener("click", () =>
        {
            let controlPanel = this.shadowRoot.querySelector(".control-panel");
            controlPanel.style.visibility = controlPanel.style.visibility == 'visible' ? 'hidden': 'visible';
        })
    }
}

export function InitMediaPipeControls(root, shadowRoot) {
    // html input params to the <mediapipe-tracking> div will override options input
    let options = {};
    let faceOption = eval(root.getAttribute("track-face"));
    let handsOption = eval(root.getAttribute("track-hands"));
    let bodyOption = eval(root.getAttribute("track-body"));
    let numBodiesOption = eval(root.getAttribute("num-bodies"));
    let showVideoOption = eval(root.getAttribute("show-video"));
    let showLandmarksOption = eval(root.getAttribute("show-landmarks"));
    let headTurnOption = eval(root.getAttribute("head-turn"));
    let fingerPosesOption = eval(root.getAttribute("check-finger-poses"));
    let wakeModeOption = eval(root.getAttribute("wake-mode"));
    let showPeopleIndicatorOption = eval(root.getAttribute("show-people-indicator"));

    if (faceOption != null) {
        options.trackFace = faceOption;
    }
    if (handsOption != null) {
        options.trackHands = handsOption;
    }
    if (bodyOption != null) {
        options.trackBody = bodyOption;
    }
    if (numBodiesOption != null) {
        options.numBodies = numBodiesOption;
    }

    if (showVideoOption != null) {
        options.showVideo = showVideoOption;
    }
    if (showLandmarksOption != null) {
        options.showLandmarks = showLandmarksOption;
    }
    if (headTurnOption != null) {
        options.checkHeadTurn = headTurnOption;
    }
    if (fingerPosesOption != null) {
        options.checkFingerPoses = fingerPosesOption;
    }
    if (wakeModeOption != null) {
        // 0=TWO_HANDS_IN, 1=FIST, 2=NONE (unsupported)
        options.wakeMode = wakeModeOption;
    }

    if (showPeopleIndicatorOption != null) {
        // If true, the people indicator will be shown
        options.showPeopleIndicator = wakeModeshowPeopleIndicatorOption;
    }

    let mpServiceProvider = new MediaPipeServiceProvider(shadowRoot, options);
    
    return new Promise((resolve) => { 
        mpServiceProvider.InitialiseTrackingServices();
        resolve(mpServiceProvider); }
    );
}
