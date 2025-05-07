import {MPTinyHand} from "../MediaPipeHandUtils.js";
import {PoseHeldForDurationDetector} from "../detectors/MediaPipeFingerPoseDetector.js";
import {GrabHeldForDurationDetector} from "../detectors/MediaPipeGrabDetector.js";

const UserState = { MISSING: 0, VISIBLE: 1, POINTING: 2, PINCHING: 3, RESET: 4 };

export class MediaPipeHands {
    constructor(checkFingerPoses = false, wakeWithFistPose = false) {
        // Boolean to set whether to check for finger poses
        this.checkFingerPoses = checkFingerPoses;

        this.wakeWithFistPose = wakeWithFistPose;
        if (this.checkFingerPoses) {
            this.poseChecker = new PoseHeldForDurationDetector();
        }
        if (this.wakeWithFistPose) {
            //console.log("MediaPipeHands, Requested to wake with Fist. Creating Grab Detector...");
            this.grabDetector = new GrabHeldForDurationDetector();
        }

        this.lastUpdate = Date.now();
        this.mpEvents = {};
        this.mpEvents.tinyHands = [new MPTinyHand(null, null), new MPTinyHand(null, null)];
        this.mpEvents.pinchPositions = [{x:0, y:0, z: 0}, {x:0, y:0, z: 0}];
        this.mpEvents.userState = 0;
        this.handNames = ['Left', 'Right'];
        this.pinchDeadzoneWS = 0.01;
    };

    PoseUpdateTick() {
        let now = Date.now();
        let dt = now - this.lastUpdate;
        this.lastUpdate = now;
        return dt;
    }

    // Updates based on:
    // "result":  an array of hand landmark data
    // "activeHandChirality":  an active hand defined by it's chirality
    // "freshHands":  fresh hands are those that contain new data in the results, otherwise it is recyled data
    UpdateHandsFromResults(results, activeHandChirality, freshHands) {
        let dt = this.PoseUpdateTick();
        for (let h = 0; h < this.mpEvents.tinyHands.length; h++) {
            let hand = this.GetHand(this.handNames[h], results);
            if (hand != null) {
                let tinyHand = new MPTinyHand(hand, this.handNames[h]);

                // Evaluate State and pinchIDs
                if (this.mpEvents.tinyHands[h] != undefined) {
                    tinyHand.pinchAge = this.mpEvents.tinyHands[h].pinchAge;
                    tinyHand.state = tinyHand.EvaluatePersistentState(tinyHand.state, this.mpEvents.tinyHands[h].state);
                    if (this.mpEvents.tinyHands[h].pinchID != -1) {
                        tinyHand.pinchID = this.mpEvents.tinyHands[h].pinchID;
                    }
                }

                if (activeHandChirality === tinyHand.chirality) {
                    // Optionally handle finger poses for shortcuts...
                    // If we're setup to check finger poses, and there's one hand...
                    if (this.checkFingerPoses) {
                        this.poseChecker.Update(dt, tinyHand);
                        tinyHand.gestureState = this.poseChecker.poseState;
                        tinyHand.gestureProgress = this.poseChecker.poseProgress;
                    }
                    // Optionally check for Wake Fist Pose, in the case of Shortcuts example this is the wake method.
                    if (this.wakeWithFistPose) {
                        this.grabDetector.Update(dt, tinyHand);
                        tinyHand.grabState = this.grabDetector.poseState;
                        tinyHand.grabProgress = this.grabDetector.poseProgress;
                    }
                }

                // Set the new hand to the persistent and
                let rawPinchPos = tinyHand.pinchPosition;
                let filteredPinchPos = this.mpEvents.tinyHands[h].GetFilteredPinchPos(rawPinchPos, freshHands);
                tinyHand.pinchPosCache = this.mpEvents.tinyHands[h].pinchPosCache;

                let pinchPos = tinyHand.DeadzonePinchPosition(this.mpEvents.pinchPositions[h], filteredPinchPos, this.pinchDeadzoneWS);
                tinyHand.pinchPosition = pinchPos;
                this.mpEvents.tinyHands[h] = tinyHand;
                this.mpEvents.pinchPositions[h] = pinchPos;
            }
            else if (this.mpEvents.tinyHands[h] != undefined)
            {
                this.mpEvents.tinyHands[h].state = this.mpEvents.tinyHands[h].EvaluatePersistentState(0, this.mpEvents.tinyHands[h].state);
                this.mpEvents.pinchPositions[h] = this.mpEvents.tinyHands[h].GetFilteredPinchPos(this.mpEvents.pinchPositions[h], false);
            }
        }

        this.GetUserState();

        return this.mpEvents.tinyHands;
    }


    GetHand(chiralityLabel, results)
    {
        // results an array of handResults
        if (results !== undefined){
            for (let i = 0; i < results.length; i++)
            {
                let label = results[i].handednesses[0].displayName;
                if (label === chiralityLabel)
                {
                    return results[i].landmarks;
                }
            }
        }
        return null;
    }

    GetUserState()
    {
        if (this.HandIsVisible(this.mpEvents.tinyHands) == false)
        {
            this.mpEvents.userState = UserState.MISSING;
        }

        switch(this.mpEvents.userState)
        {
            case UserState.MISSING: 
                if (this.HandIsVisible(this.mpEvents.tinyHands) == true)
                {
                    this.mpEvents.userState = UserState.VISIBLE;
                }
                break;
            case UserState.VISIBLE: 
                if (this.HandIsPinching(this.mpEvents.tinyHands) == true)
                {
                    this.mpEvents.userState = UserState.PINCHING;
                    let pinchIds = this.GetPinchIDs(this.mpEvents.tinyHands);
                    this.mpEvents.tinyHands[0].pinchID = pinchIds.pinchID0;
                    this.mpEvents.tinyHands[1].pinchID = pinchIds.pinchID1;
                }
                else if (this.HandIsPointing(this.mpEvents.tinyHands) == true)
                {
                    this.mpEvents.userState = UserState.POINTING;
                }
                break;
            case UserState.POINTING: 
                if (this.HandIsPointing(this.mpEvents.tinyHands) == false)
                {
                    this.mpEvents.userState = UserState.VISIBLE;
                }
                break;
            case UserState.PINCHING:
                let pinchIds = this.GetPinchIDs(this.mpEvents.tinyHands);
                
                if (this.HandIsPinching(this.mpEvents.tinyHands) == false || pinchIds.changed == true)
                {
                    this.mpEvents.userState = UserState.VISIBLE;
                }
                else
                {
                    this.mpEvents.tinyHands[0].pinchID = pinchIds.pinchID0;
                    this.mpEvents.tinyHands[1].pinchID = pinchIds.pinchID1;
                }
                break;
            case UserState.RESET:
                this.mpEvents.userState = UserState.MISSING;
                break;
        }
    }

    HandIsVisible(hands)
    {
        const leftVisible = hands[0].state != UserState.MISSING;
        const rightVisible = hands[1].state != UserState.MISSING;

        return leftVisible || rightVisible ;
    }

    HandIsPinching(hands)
    {
        if (hands[0].state == UserState.PINCHING || hands[1].state == UserState.PINCHING)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    HandIsPointing(hands)
    {
        if (hands[0].state == UserState.POINTING || hands[1].state == UserState.POINTING)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    GetPinchIDs(hands)
    {
        let pinchID0 = hands[0].pinchID;
        let pinchID1 = hands[1].pinchID;
        if (hands[0].fingers.length > 0 && hands[0].IsPinching() == true)
        {
            hands[0].pinchID = hands[0].pinchAge >= hands[1].pinchAge ? 0 : 1;
        }
        else
        {
            hands[0].pinchID = -1;
        }
        if (hands[1].fingers.length > 0 && hands[1].IsPinching() == true)
        {
            if (hands[0].fingers.length == 0 || hands[0].IsPinching() == false)
            {
                hands[1].pinchID = 0;
            }
            else
            {
                hands[1].pinchID = hands[1].pinchAge > hands[0].pinchAge ? 0 : 1;
            }
        }
        else
        {
            hands[1].pinchID = -1;
        }

        const pinchID0Changed = pinchID0 != hands[0].pinchID;
        const pinchID1Changed = pinchID1 != hands[1].pinchID;

        return {
            changed: pinchID0Changed == true || pinchID1Changed == true,
            pinchID0: hands[0].pinchID,
            pinchID1: hands[1].pinchID
        };
    }
}


