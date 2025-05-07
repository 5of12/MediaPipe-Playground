# MediaPipe Playground

A collection of JavaScript examples showcasing Google's [Mediapipe API](https://github.com/google-ai-edge/mediapipe). 
<br>The examples focus on hand and body tracking for fun and experimentation.
<br>We also demonstrate how to combine Body with Hand tracking, for associating hands with Google's [Tasks Vision API](https://ai.google.dev/edge/api/mediapipe/js/tasks-vision) 

# Running Web Examples

## Requirements

- Node (latest LTS) - downloadable from: https://nodejs.org/en/download
- A webcam (laptop integrated or USB)

## Setup

1. `npm install` to initialise the project
2. `npm start` to run a development web server
3. `npm run build` to package the files into a `dist` directory
4. `npm run preview` to server the built files for testing

<h1 id="examples">Examples Overview</h1>

All examples are designed to run in the browser, and assume you have given access to a webcam.
<br>If you don't see a camera image as expected, click the Settings button in the top-left, 
<br>then select the device from dropdown.

<img src="/media/settings.png" width="200">

## Spin the Shark
This example shows how to explore a ThreeJS 3D Model with your hand.

![Animation of a 3D shark being moved with a hand](/media/shark.gif "3D Model Animation")

1. Hold one hand in front of your chest and a Tiny Hand should appear!
2. Pinch and drag to spin the shark!

## Warp Fingers
This example shows how to warp through space, using five finger poses.

![Animation of warping through space using finger poses](/media/starfield.gif "Space Warp Animation")

1. Hold one hand in front of your chest and a Tiny Hand should appear!
2. Form a finger pose by holding out 1-5 fingers.
3. Hold the pose until you warp through space!

## World in your Hands
This example shows how to explore a 2D World Map using your hands.

![Animation of a 2D world map being explored with hands](/media/map.gif "2D Map Animation")

1. Hold one hand in front of your chest and a Tiny Hand should appear!
2. Point up with your finger and move the tiny hand to highlight a country.
3. If you bring your index and thumb together, to form a 'pinch' you will be able to drag the map.
4. Raise a second hand and pinch, then move your hands together/apart to zoom the map.

# Software Overview

## Control Scripts

Examples of demo scripts and use cases for MediaPipe controlling UI are below:

### Pointer control
- `MediaPipeMultiHandInput.js` and `MouseLikePointerInput` interfaces with `MediaPipeServiceProvider.js` to receive a stream of tracking data for multiple people. The event data contains body, head and hand information for up to two people. The active person generates pointer events for up to two touches.

### Shortcuts
- `MediaPipeWarpFingerPoses.js` interfaces with `MediaPipeServiceProvider.js` to receive a stream of tracking data for multiple people and detected gestures for the active user. The gesture detection is connected directly to screen changes and icon graphics updates in this script.

## MediaPipe Tracking Component <mediapipe-tracking>

To add MediaPipe Tracking to your HTML example, source this script: `scripts/MediaPipeTracking.js`
<br>Then add the `<mediapipe-tracking>` component to your HTML 
<br>See the code in [Examples Overview](#examples) for usage examples.

### Notes on MediaPipe Service Provider
Management of the MediaPipe system is handled by a set of Service Provider wrapper classes to facilitate reuse of image frames from the webcam and manage multi-body detectoin. 
<br>Update of the tracking data is alternated between body and hand tracking to reduce system load. 
<br>Extrapolation is used so hand tracking updates every frame, even when lacking new data.

### Service Providers
- `MediaPipeServiceProvider.js` is the entry point to the system. This manages accessing the webcam images, starting the individual body pose and hands services, as well as controlling the flow of updates to the tracking data.
- `MediaPipeTasksVisionBodyPoseService.js` configures the body tracking system to work with up to two bodies. The service uses the body pose processor to generate a data structure for each of the people in the camera image.
- `MediaPipeTasksVisionHandsService.js` configures the hand tracking system to work with up to four hands. The hands are associated with tracked bodies to enable an active person to be assigned using the wake gesture.

### Processors
- `MediaPipeBodyPoseProcessor.js` takes raw tracking landmark data and processes the relevant data for use by the system. For each tracked body we generate an interaction rect around the shoulders that is used to detect active hands and convert cursor positions to screen space.
- `MediaPipeHandsProcessor.js` takes raw tracking landmark data and processes the relevant data for use by the system. For each tracked hand we generate a stable pinch position for pointer interactions, which is smoothed and deadzoned to remove noise from the tracking data. Hand data is organised into a heirarchy of fingers to make information easier to parse. The hand processor also manages pinch and gesture detection for each hand.

### Detectors
- `MediaPipeFingerPoseDetector.js` uses hand data to determine how many fingers are extended. Pose detection requires the palm to be facing the camera to filter out unwanted activations.
- `MediaPipeGrabDetector.js` uses hand data to determine if the hand is in a closed grab (fist) pose.
- `MediaPipeHeadDirectionDetector.js` uses body tracking data to determine the direction the head is facing for a given person. 