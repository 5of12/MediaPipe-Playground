let focusedDiv = null;
let focusableDivs = null;

// return true if in range, otherwise false
function inRange(x, min, max) {
    return ((x-min)*(x-max) <= 0);
}

export function UpdateHeadFocus(eventData, divs) {
    if (eventData.body === undefined) {
        console.warn("UpdateHeadFocus called but eventData had no body data!");
        return;
    }
    focusableDivs = divs;

    for (let i = 0; i < focusableDivs.length; i++) {
        let div = focusableDivs[i];
        let headXFocus = div.dataset.headxfocus;
        let minMax = eval(headXFocus);
        let min = minMax[0].min;
        let max = minMax[0].max;
        let prevDiv = focusedDiv;
        let yaw = eventData.body.poseData.headTurnYaw;
        if (inRange(yaw, min, max)) {
            focusedDiv = div;
            if (prevDiv !== focusedDiv){
                SoloFocusableDiv(focusedDiv);
            }
        }
    }
    return focusedDiv;
}

export function ResetAllDivFocus(){
    if (focusableDivs == null){
        return;
    }
    for (let i = 0; i < focusableDivs.length; i++) {
        let div = focusableDivs[i];
        div.style.opacity = '1';
    }
}

function SoloFocusableDiv(div){
    for (let i = 0; i < focusableDivs.length; i++) {
        let testDiv = focusableDivs[i];
        testDiv.style.transition = '.25s';
        if (div === testDiv) {
            testDiv.style.opacity = '1';
        }
        else{
            testDiv.style.opacity = '0.9';
        }
    }
}