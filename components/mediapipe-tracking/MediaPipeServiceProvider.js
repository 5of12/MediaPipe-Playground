import controls from '@mediapipe/control_utils';
import {MediaPipeTasksVisionBodyPoseService} from "./services/MediaPipeTasksVisionBodyPoseService.js";
import {MediaPipeTaskVisionHandsService} from "./services/MediaPipeTasksVisionHandsService.js";
import {MediaPipeTaskVisionFaceMeshService} from "./services/MediaPipeTasksVisionFaceMeshService.js";
import {MediaPipePeopleIndicator, PEOPLE_INDICATOR_DIV_NAME} from "./MediaPipePeopleIndicator.js";
import {PoseStates} from "./processors/MediaPipeBodyPoseProcessor.js";
import {MediaPipeHands} from "./processors/MediaPipeHandsProcessor.js";

// Set by <mediapipe-tracking> option: 'wake-mode=INT' (0=TWO_HANDS_IN, 1=FIST,2=NONE)
export const WAKE_MODE = ["TWO_HANDS_IN", "FIST", "NONE"]

export class MediaPipeServiceProvider {
    // The job of this class is to obtain a shared camera feed, and initiate the requested tracking Services
    // (see /services directory), for Hands, Face and Body pose tracking.
    constructor(controlsElement, options) {
        // Define the People Indicator UI Component...
        // This is the shadowRoot of the component, created in components/MediaPipeTrackingControls.
        this.rootControls = controlsElement;
        // Our input frames will come from here (e.g. Webcam video)
        this.videoElement = this.rootControls.querySelector('.mp-video-canvas');
        this.videoCanvasCtx = this.videoElement.getContext('2d');

        // Canvas where video+landmark overlays are drawn.
        this.canvasElement = this.rootControls.querySelector('.mp-hands-overlay-canvas');

        // The Control panel which appears in the top-left.
        this.controlsElement = this.rootControls.querySelector('.control-panel');

        // The Drawing Landmark canvas context
        this.canvasCtx = this.canvasElement.getContext('2d');

        // Canvas where video+landmark overlays are drawn.
        this.tasksVisionCanvasElement = this.rootControls.querySelector('.mp-body-overlay-canvas');
        this.tasksVisionCanvasCtx = this.tasksVisionCanvasElement.getContext('2d');

        // The last video image frame...
        this.lastImage = null;

        // Element to enable hooking into events
        this.eventDispatcher = document.createElement("div"); // create a <div> element

        this.trackHands = (options.trackHands !== undefined) ? options.trackHands : true;
        this.trackFace = (options.trackFace !== undefined) ? options.trackFace : false;
        this.trackBody = (options.trackBody !== undefined) ? options.trackBody : false;

        // This switch will determine whether we use MultiBodyPose Service, or single...
        this.numBodies = (options.numBodies !== undefined) ? options.numBodies : 1;

        this.showPeopleIndicator = (options.showPeopleIndicator !== undefined) ? options.showPeopleIndicator : true;

        // Define the MediaPipe People Indicator Controls
        window.customElements.define(PEOPLE_INDICATOR_DIV_NAME, MediaPipePeopleIndicator);

        // Define the People Indicator UI Component...
        window.customElements.whenDefined(PEOPLE_INDICATOR_DIV_NAME).then(() => {
            this.peopleIndicatorElement = this.rootControls.querySelector(PEOPLE_INDICATOR_DIV_NAME);
            if (!this.showPeopleIndicator) {
                if (this.peopleIndicatorElement !== null) {
                    this.peopleIndicatorElement.style.visibility = 'hidden';
                }
            }
            console.log('GOT A PEOPLE INDICATOR: ' + this.peopleIndicatorElement);
        });

        // Track two hands per body...
        this.numHands = this.numBodies * 2;

        console.log("MediaPipeServiceProvider numBodies: " + this.numBodies);
        this.showLandmarks = (options.showLandmarks !== undefined) ? options.showLandmarks : true;
        this.showVideo = (options.showVideo !== undefined) ? options.showVideo : true;
        this.selfieMode = (options.selfieMode !== undefined) ? options.selfieMode : true;

        // This option is only used by the MediaPipeHandsService
        this.checkFingerPoses = (options.checkFingerPoses !== undefined) ? options.checkFingerPoses : false;

        // The option to set how the method of waking up / becoming the active person with hands
        this.wakeMode = (options.wakeMode !== undefined) ? WAKE_MODE[options.wakeMode] : WAKE_MODE[2];

        // This option is only used by the MediaPipeHandsService
        this.wakeWithFistPose = (this.wakeMode === WAKE_MODE[1]);

        console.log("NUM BODIES REQUESTED:" + this.numBodies + ", wake mode: " + this.wakeMode + ", wakeWithFistPose: " + this.wakeWithFistPose);

        // This option is only used by the MediaPipeBodyService (and later the FaceMeshService?
        this.checkHeadTurn = (options.checkHeadTurn !== undefined) ? options.checkHeadTurn : false;

        this.showVideoToggle = new controls.Toggle({title: 'Show Video', field: 'showVideo'});
        this.showLandmarksToggle = new controls.Toggle({title: 'Show Landmarks', field: 'showLandmarks'});

        // Tracking active person following a wake gesture
        this.awakePerson = null;
        this.awakeCandidate = {person: null, timestamp: 0};
        this.wakeHoldTimeMS = 200;

        // After a period of Hand inactivity, this timer will remove the active person...
        this.removeActivePersonAfterTimeout = true; // if true, we check for inactivity...
        this.inactivityLastUpdate = Date.now();
        this.inactiveHandTimeoutMS = 5000; // The time after no hands in rect, that we remove the active person
        this.inactiveHandTime = 0; // Timestamp incrementing when hands are inactive.

        // A value we cycle to choose which tracking to update
        this.poseUpdateCounter = 0;
        // Counter will increment by one each frame and resets to 0 when it hits cycle length
        this.cycleLength = 3;
        // How many frames out of the cycle on which to update the body pose
        this.poseDutyTime = 1;

        // Make persistent people...
        this.mmpEventData = {
            people: [ { name: "pete", body: null, hands: null, face: null},
                      { name: "ant", body: null, hands: null, face: null} ],
            activePerson: null,
        };
    }

    async InitialiseTrackingServices(){
        if (this.trackBody) {
            this.bodyTracking = new MediaPipeTasksVisionBodyPoseService(this);
            await this.bodyTracking.InitialisePoseDetector(this.numBodies);
        }

        if (this.trackHands){
            this.handTracking = new MediaPipeTaskVisionHandsService(this);
            await this.handTracking.InitialiseHandDetector(this.numHands);
        }

        if (this.trackFace){
            this.faceTracking = new MediaPipeTaskVisionFaceMeshService(this);
            await this.faceTracking.InitialiseFaceMeshDetector();
        }

        // We'll add this to our control panel later, but we'll save it here so we can
        // call tick() each time the graph runs.
        this.fpsControl = new controls.FPS();

        const cameraOptions = {width: 640, height: 480};

        this.sourcePicker = new controls.SourcePicker({
            cameraOptions: cameraOptions,
            onSourceChanged: () => {
                // Resets because the pose gives better results when reset between
                // source changes.
                //this.mediaPipeTrackingAll.reset();
                this.handleVideoSourceChanged();
            },
            onFrame: async (input, size) => {
                const aspect = size.height / size.width;
                let width, height;
                if (window.innerWidth > window.innerHeight) {
                    height = window.innerHeight;
                    width = height / aspect;
                }
                else {
                    width = window.innerWidth;
                    height = width * aspect;
                }
                if (this.canvasElement.width != Math.floor(width))
                {
                    this.canvasElement.width = width;
                    this.canvasElement.height = height;
                    this.tasksVisionCanvasElement.width = width;
                    this.tasksVisionCanvasElement.height = height;
                }
                this.lastImage = input;
                this.updateVideoFrame();
                this.updateTrackers();
            },
        });

        window.requestAnimationFrame(() => { this.updateWithAnimationLoop(); });

        // Optimization: Turn off animated spinner after its hiding animation is done.
        this.spinner = this.rootControls.querySelector('.loading');
        this.updateTrackerCachedResults = this.updateTrackerCachedResults.bind(this);

        // Present a control panel through which the user can manipulate the solution
        // options.
        new controls
            .ControlPanel(this.controlsElement, {
                selfieMode: this.selfieMode,
                showVideo: this.showVideo,
                showLandmarks: this.showLandmarks,
                trackHands: this.trackHands,
                trackFace: this.trackFace,
                trackBody: this.trackBody,
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                effect: 'background',
            })
            .add([
                new controls.StaticText({ title: 'Max Body Count: ' + this.numBodies }),
                this.sourcePicker,
                this.fpsControl,
                this.showVideoToggle,
                this.showLandmarksToggle,
            ])
            .on(x => {
                const options = x;
                this.videoElement.classList.toggle('hidden', !options.showVideo);
                this.videoElement.classList.toggle('selfie', options.selfieMode);
                this.canvasElement.classList.toggle('selfie', options.selfieMode);
                this.tasksVisionCanvasElement.classList.toggle('selfie', options.selfieMode);
            });


            // We have to set up the Source Selection dropdown to behave properly to clicks, because the logic
            // for handling the click is based on a standard DOM, not shadowRoot.
            let sourceSelector = this.controlsElement.querySelector('.source-selection');
            sourceSelector.onclick = (e) => {
                // source-selection
                sourceSelector.classList.toggle("open");

                // Accessing the class in children corresponding to the class=dropdown
                let dropdown = sourceSelector.childNodes[0].childNodes[0];
                dropdown.classList.toggle("open");

                // Accessing the class in dropdown children of class=dropdown-options
                // and toggle the visibility of dropdown-options.
                let dropdownOptions = dropdown.childNodes[1];
                if (dropdownOptions.style.display === "none") {
                    dropdownOptions.style.display = "block";
                } else {
                    dropdownOptions.style.display = "none";
                }
            }
    }

    updateWithAnimationLoop()
    {
        if (this.bodyTracking.bodyPoseResults != null)
        {
            this.updateTrackerCachedResults();
        }
        window.requestAnimationFrame(() => { this.updateWithAnimationLoop(); });
    }

    updateTrackerCachedResults() {
        if (this === undefined) {
            return;
        }
        let newData = {
            hands: null,
            face: null,
            multiBody: null
        };

        if (this.trackBody && this.bodyTracking !== undefined && this.bodyTracking !== null) {
            newData.multiBody = this.bodyTracking.updateFromCachedResult();
        }

        // cConstruct multi media pipe event data (max 2 people for now...)
        this.mmpEventData.people[0].body = newData.multiBody[0];
        this.mmpEventData.people[1].body = newData.multiBody[1];

        if (this.trackHands && this.handTracking !== undefined && this.handTracking !== null) {
            let people = this.mmpEventData.people;
            let handPairs = this.handTracking.getAssociatedHandsForPeople(people);
            if (handPairs != undefined) {
                this.mmpEventData.activePerson = this.getActivePersonForHandPairs(people, handPairs);
            }
        }
        if (this.trackFace && this.faceTracking !== undefined && this.faceTracking !== null) {
            this.faceTracking.updateFromCachedResult();
        }

        const mpEvent = new CustomEvent("OnMPFrame", { detail: this.mmpEventData });
        if (this.showPeopleIndicator && this.peopleIndicatorElement != null) {
            //this.peopleIndicatorElement.UpdatePeopleIndicator();
            this.peopleIndicatorElement.UpdateActivePersonIcon(this.mmpEventData.activePerson, this.mmpEventData.people);
        }
        this.eventDispatcher.dispatchEvent(mpEvent);
    }

    updateVideoFrame(){
        // Optionally draw the image feed.
        if (this.showVideoToggle.options.showVideo){
            this.videoCanvasCtx.drawImage(this.lastImage, 0, 0, this.videoElement.width, this.videoElement.height);
        }
    }

    updateTrackers() {
        this.fpsControl.tick();
        const poseUpdate = this.poseUpdateCounter < this.poseDutyTime;

        if (poseUpdate && this.trackBody && this.bodyTracking !== undefined) {
            this.bodyTracking.updatePoseFromImage(this.lastImage);
        }
        if (!poseUpdate && this.trackHands && this.handTracking !== undefined) {
            this.handTracking.updatePoseFromImage(this.lastImage);
        }
        if (this.trackFace && this.faceTracking !== undefined) {
            this.faceTracking.updateFaceFromImage(this.lastImage);
        }
        this.poseUpdateCounter = (this.poseUpdateCounter + 1) % this.cycleLength;
    }

    handleVideoSourceChanged(){
        // Hide the spinner if we're here...
        if (this.spinner !== null) {
            this.spinner.remove();
            this.spinner = null;
        }
    }

    HandInactivityUpdateTick() {
        let now = Date.now();
        let dt = now - this.inactivityLastUpdate;
        this.inactivityLastUpdate = now;
        return dt;
    }


    getActivePersonForHandPairs(people, handPairs) {
        // The purpose of this method is to determine who the activePerson should be, given a pair of people (upto 2) with associated hand pairs
        // handPairs at this point are MediaPipe Results, NOT MediaPipeHands (with TinyHands)
        // people is [person0, person1], handPairs: [[person0LeftHand?, person0RightHand?], [person1LeftHand?, person1RightHand?]]
        let active = null;
        let dt = this.HandInactivityUpdateTick();

        const awakePersonPresent = this.awakePerson != null &&
            (this.awakePerson.body.poseData.handInRectChirality !== "None" );

        // Optionally test that if no hands are present after timeout, remove the active person...
        if (this.removeActivePersonAfterTimeout){
            if (awakePersonPresent) {
                this.inactiveHandTime = 0;
            }
            else{
                if (this.awakePerson != null) {
                    this.inactiveHandTime += dt;
                    if (this.inactiveHandTime > this.inactiveHandTimeoutMS) {
                        console.log("Hands Inactive for timeout...Setting active person to null");
                        // DISPATCH OnNoActivePerson
                        const noActivePersonEvent = new CustomEvent("OnMPNoActivePerson", { detail: this.mmpEventData });
                        this.eventDispatcher.dispatchEvent(noActivePersonEvent);
                        this.awakePerson = null;
                        return null;
                    }
                }
            }
        }

        for (const personIndex in people)
        {
            let person = people[personIndex];
            person.handResults = handPairs[personIndex];
            if (person.hands == null) {
                person.hands = new MediaPipeHands(this.checkFingerPoses, this.wakeWithFistPose);
            }
            person.hands.UpdateHandsFromResults(person.handResults, person.body.poseData.handInRectChirality, this.handTracking.freshHands);

            if (person.body.poseData.poseState == PoseStates.IN_SHOULDER_RECT)
            {
                if (this.personAttemptingWake(person))
                {
                    if (this.awakeCandidate.person == null || this.awakeCandidate.person.name !== person.name)
                    {
                        let newPerson = {
                            body : person.body,
                            hands : person.hands,
                            name : person.name,
                        }
                        this.awakeCandidate = {
                            person: newPerson,
                            timestamp: Date.now()
                        }
                    }
                    else
                    {
                        // Look at the candidate for awake person instead and see if they are awake
                        if (Date.now() - this.awakeCandidate.timestamp > this.wakeHoldTimeMS )
                        {
                            // We have a new awake person!
                            active = person;
                        }
                    }
                }
                else
                {
                    // There's no active candidate so clear the data
                    this.awakeCandidate = { person: null, timestamp: 0 };
                }
            }
        }

        // If we have an active person they are awake
        if (awakePersonPresent)
        {
            active = this.awakePerson;
        }
        else if (active !== null)
        {
            this.awakePerson = active;
        }

        this.handTracking.freshHands = false;
        return active;
    }

    // This can be replaced by a wave or other such detection method
    personAttemptingWake(person)
    {
        if (this.wakeMode === "TWO_HANDS_IN"){
            return person.body.poseData.handsInRect === 2 && person.body.poseData.movementState === "STATIC";
        }
        else if (this.wakeMode === "FIST"){
            if (person.hands == null){
                return false;
            }
            let oneFistIn = person.body.poseData.handsInRect === 1 && person.hands.grabDetector.poseState === "GRABBING";
            return oneFistIn;
        }
        else{
            // NONE... Not currently recommended as this is no wake gesture...
            return true;
        }
    }
}