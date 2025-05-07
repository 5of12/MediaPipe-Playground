// This provides the MediaPipe Service Provider Singleton,
// To be used in conjunction with <mediapipe-tracking> custom component.
// To use in your scripts:
//
// import {MEDIAPIPE_TRACKING_DIV_NAME, MediaPipeServiceProvider} from "./MediaPipeTracking.js";import {MediaPipeServiceProvider} from "./MediaPipeTracking.js";
//
// Wait for the component to be initialised and get a reference to MediaPipeServiceProvider:
//     window.customElements.whenDefined(MEDIAPIPE_TRACKING_DIV_NAME).then(() => {
//         if (MediaPipeServiceProvider !== null) {
//             // Now access MediaPipeServiceProvider singleton...

import {MediaPipeTrackingControls, InitMediaPipeControls} from "../components/mediapipe-tracking/MediaPipeTrackingControls.js";

// The expected Class name for this div
export const MEDIAPIPE_TRACKING_DIV_NAME = "mediapipe-tracking"
window.customElements.define(MEDIAPIPE_TRACKING_DIV_NAME, MediaPipeTrackingControls);

export let MediaPipeServiceProvider;
window.customElements.whenDefined(MEDIAPIPE_TRACKING_DIV_NAME).then(() => {
    let el = document.querySelector(MEDIAPIPE_TRACKING_DIV_NAME);
    if (el !== null && el.shadowRoot !== undefined) {
        // We don't need the Hand Tracker is setup to check finger poses...
        InitMediaPipeControls(el, el.shadowRoot).then((serviceProvider) => {
            console.log("MediaPipeServiceProvider loaded...");
            MediaPipeServiceProvider = serviceProvider;
            let initEvent = new Event('OnMPServiceInitialized');
            window.dispatchEvent(initEvent);
        });
    }
})