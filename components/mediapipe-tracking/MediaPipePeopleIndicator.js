const activePersonIcon = new URL("./icons/PersonActive.png", import.meta.url).href;
const inactivePersonIcon = new URL("./icons/PersonInactive.png", import.meta.url).href;
const visiblePersonIcon = new URL("./icons/PersonVisible.png", import.meta.url).href;
const cssStyle = new URL('css/PeopleIndicator.css', import.meta.url).href

export const PEOPLE_INDICATOR_DIV_NAME = "people-indicator";

const template = document.createElement('template');
template.innerHTML = `
    <link rel="stylesheet" href="${cssStyle}"></link>
    <div id="peopleIndicator" class="peopleContainer">
        <image class="personIcon" src="${inactivePersonIcon}"></image>  
        <image class="personIcon" src="${inactivePersonIcon}"></image>
    </div>
`

export class MediaPipePeopleIndicator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.peopleIcons = this.shadowRoot.querySelectorAll('.personIcon');
        this.peopleContainer = this.shadowRoot.querySelector('.peopleContainer');
    }
    
    SetPosition(bottom = null, left = null)
    {
        if (top != null) this.peopleContainer.style.setProperty('--bottom', bottom);
        if (left != null) this.peopleContainer.style.setProperty('--left', left);
    }

    SetSize(size)
    {
        this.peopleIcons.forEach((icon) => { icon.style.setProperty('--height', size) });
    }

    UpdateActivePersonIcon(activePerson, people)
    {
        for(let person in people)
        {
            if (activePerson != null && activePerson.name === people[person].name)
            {
                this.peopleIcons[person].src = activePersonIcon;
            }
            else if (people[person].body.poseData.poseState !== "MISSING")
            {
                this.peopleIcons[person].src = visiblePersonIcon;
            }
            else
            {
                this.peopleIcons[person].src = inactivePersonIcon;
            }
        }
    }
}