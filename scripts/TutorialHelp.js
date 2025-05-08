// Tutorial Management
let helpOverlay = document.querySelector(".tutorial-origin", ".instruction");
let helpText = document.querySelector(".text");
let spinText = document.querySelector(".lower");
let videoCanvas = document.querySelector('.video');


export function ShowHelp(){
    if (helpOverlay == null){
        return;
    }
    if (helpOverlay.classList.contains("hidden"))
    {
        HideSearching();
        helpOverlay.classList.remove("hidden");
        helpOverlay.classList.add("visible");
        helpText.classList.remove("hidden");
        helpText.classList.add("visible");

        spinText.classList.remove("visible");
        spinText.classList.add("hidden");

        videoCanvas.classList.remove("shrink");
        videoCanvas.classList.add("flipped");
    }
}

export function HideHelp(){
    if (helpOverlay == null){
        return;
    }
    if (helpOverlay.classList.contains("visible"))
    {
        helpOverlay.classList.remove("visible");
        helpOverlay.classList.add("hidden");
        helpText.classList.remove("visible");
        helpText.classList.add("hidden");

        spinText.classList.add("visible");
        spinText.classList.remove("hidden");

        videoCanvas.classList.add("shrink");
        videoCanvas.classList.remove("flipped");
    }
}

export function ShowSearching(msg = 'Sit back and hold hand at chest height') {
    if (helpOverlay == null){
        return;
    }

    if (helpOverlay.classList.contains("waiting"))
    {
        helpOverlay.classList.add("searching");
        helpOverlay.classList.remove("waiting");
        helpText.textContent = msg;
    }
}

export function HideSearching() {
    if (helpOverlay == null){
        return;
    }

    if (helpOverlay.classList.contains("searching"))
    {
        helpOverlay.classList.remove("searching");
        helpOverlay.classList.add("waiting");
    }
}