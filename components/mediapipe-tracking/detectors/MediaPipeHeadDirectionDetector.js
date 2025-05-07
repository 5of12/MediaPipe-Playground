export class MediaPipeHeadDirectionDetector {
    // Class to handle calculation head direction from Body Pose Head Landmarks.
    // if 'expectBodyPoseLandmarks' is true, landmark calculation is based upon the Body Pose Landmarks (simplified head landmarks)
    // otherwise, faceMesh landmarks are assumed (much more detailed head representation)
    constructor(expectBodyPoseLandmarks = true) {
        this.expectBodyPoseLandmarks = expectBodyPoseLandmarks;
        console.log("*** MediaPipeHeadDirectionDetector expecting Body Pose landmarks: " + this.expectBodyPoseLandmarks);
    }

    GetHeadYaw(landmarks){
        if (this.expectBodyPoseLandmarks){
            return GetHeadDirectionFromBodyPoseLandmarks(landmarks).yaw;
        }
        else {
            return GetHeadDirectionFromFaceMeshLandmarks(landmarks).yaw;
        }
    }
}

// Helper functions
function getAngleBetweenLines(midpoint, point1, point2) {
    const vector1 = { x: point1.x - midpoint.x, y: point1.y - midpoint.y };
    const vector2 = { x: point2.x - midpoint.x, y: point2.y - midpoint.y };

    // Calculate the dot product of the two vectors
    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;

    // Calculate the magnitudes of the vectors
    const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

    // Calculate the cosine of the angle between the two vectors
    const cosineTheta = dotProduct / (magnitude1 * magnitude2);

    // Use the arccosine function to get the angle in radians
    const angleInRadians = Math.acos(cosineTheta);

    // Convert the angle to degrees
    const angleInDegrees = (angleInRadians * 180) / Math.PI;

    return angleInDegrees;
}

function GetHeadDirectionFromBodyPoseLandmarks(landmarks) {
    let noseTip, leftNose, rightNose;
    if (landmarks === undefined || landmarks.length <= 0) {
        console.log("No Valid Head data, unable to determine head direction!" + landmarks);
        return {"yaw": 0, "turn": 0};
    }
    try {
        noseTip = {...landmarks[0], name: "nose tip"};
        leftNose = {...landmarks[5], name: "left nose"};
        rightNose = {...landmarks[2], name: "right nose"};
    } catch (error) {
        console.log("error creating directional points", landmarks, error);
    }

    // MIDESCTION OF NOSE IS BACK OF NOSE PERPENDICULAR
    const midpoint = {
        x: (leftNose.x + rightNose.x) / 2,
        y: (leftNose.y + rightNose.y) / 2,
        z: (leftNose.z + rightNose.z) / 2,
    };
    const perpendicularUp = {x: midpoint.x, y: midpoint.y - 50, z: midpoint.z};

    // CALC ANGLES - pitch is currently unused
    //const pitch = getAngleBetweenLines(midpoint, noseTip, perpendicularUp);

    // This is YAW - that we use for the Left-To-Right Turning... facing forwards to camera is 0 turn...
    const yaw = getAngleBetweenLines(midpoint, rightNose, noseTip) - 90;
    return {"yaw": yaw};
}

function GetHeadDirectionFromFaceMeshLandmarks(keyPoints) {
    let noseTip, leftNose, rightNose;
    try {
        noseTip = {...keyPoints[1], name: "nose tip"};
        leftNose = {...keyPoints[279], name: "left nose"};
        rightNose = {...keyPoints[49], name: "right nose"};
    } catch (error) {
        console.log("error creating directional points", keyPoints, error);
    }

    // MIDESCTION OF NOSE IS BACK OF NOSE PERPENDICULAR
    const midpoint = {
        x: (leftNose.x + rightNose.x) / 2,
        y: (leftNose.y + rightNose.y) / 2,
        z: (leftNose.z + rightNose.z) / 2,
    };
    const perpendicularUp = {x: midpoint.x, y: midpoint.y - 50, z: midpoint.z};

    // CALC ANGLES - pitch is currently unused
    //const pitch = getAngleBetweenLines(midpoint, noseTip, perpendicularUp);

    // This is YAW - that we use for the Left-To-Right Turning... facing forwards to camera is 0 turn...
    const yaw = getAngleBetweenLines(midpoint, rightNose, noseTip) - 90;
    return {"yaw": yaw};
}