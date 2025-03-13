import {
    downloadIcon,
    leftArrIcon,
    rightArrIcon,
    preloaderButton,
    instituteLogo,
    preloader,
} from "./icons";


let isInitialized = false;
let rootNode;
let userId;
const timetableModel = {
    table: [],
    mode: {
        name: "day",
        state: {
            day: 0,
            week: 0,
        },
    },
}
const defaultHTML = `
<div class="timetable">
  <div class="timetable-day">
    <div class="timetable-day__title">
      ______________ __.__.____
    </div>
    <div class="timetable-card">
      <div class="timetable-card__functional-container">
        <div class="timetable-card__title">__________</div>
        <div class="timetable-card__type badge">_______</div>
      </div>
      <div class="timetable-card__time">__:__ - __:__</div>
      <div class="timetable-card__functional-container">
        <div class="timetable-card__teacher">______________________________</div>
        <div class="timetable-card__location badge">___ (_)</div>
      </div>
    </div>
  </div>
</div>
`;

const tableCardHTML = `
<div class="timetable-card">
  <div class="timetable-card__functional-container">
    <div class="timetable-card__title">__________</div>
    <div class="timetable-card__type badge">_______</div>
  </div>
  <div class="timetable-card__time">__:__ - __:__</div>
  <div class="timetable-card__functional-container">
    <div class="timetable-card__teacher">______________________________</div>
    <div class="timetable-card__location badge">___ (_)</div>
  </div>
</div>
`;


function initPage() {
    if (isInitialized) {
        return;
    }
    if (typeof instituteLogo != 'undefined' && document.querySelector(".header__logo")) {
        document.querySelector(".header__logo").innerHTML = instituteLogo;
    }
    isInitialized = true;
    rootNode.innerHTML = defaultHTML;
    const tt = document.querySelector(".timetable");
    const day = document.querySelector(".timetable-day");
    const card = document.querySelector(".timetable-card");
    for (let i = 0; i < 3; i ++) {
        day.appendChild(card.cloneNode(true));
    }
    for (let i = 0; i < (timetableModel.mode.name == "week" ? 4 : 0); i ++) {
        tt.appendChild(day.cloneNode(true));
    }
    const preloaderContainer = document.createElement("div");
    preloaderContainer.classList.add("preloaderContainer");
    preloaderContainer.innerHTML = preloader;
    tt.children[tt.children.length-1].appendChild(preloaderContainer);
    rootNode.insertBefore(createModeSelectionPanel(), tt);
    initExportCalendarButton();
}

function initExportCalendarButton() {
    if (!document.querySelector(".export-calendar-button") && document.querySelector("#export-calendar-button")) {
        const btn = document.createElement("button");
        btn.classList.add("export-calendar-button");
        btn.onclick = () => {
            document.querySelector("#export-calendar-button").click();
        }

        btn.innerHTML = `${typeof downloadIcon != 'undefined' ? downloadIcon : ""} Экспортировать расписание`;
        document.querySelector(".header__account-info").insertBefore(
            btn,
            document.querySelector(".header__account-log-out"),
        );
    }
}

function createModeSelectionPanel() {
    const modes = [
        ["Сегодня", "day"],
        ["Завтра", "tomorrow"],
        ["Неделя", "week"],
    ];
    const panel = document.createElement("div");
    panel.classList.add("mode-selection");

    const prevButton = document.createElement("div");
    prevButton.classList.add("mode-selection__previous-button");
    prevButton.classList.add("mode-selection__arrow-button");
    prevButton.innerHTML = typeof leftArrIcon != 'undefined' ? leftArrIcon : "<";
    prevButton.onclick = decrementState;

    const nextButton = document.createElement("div");
    nextButton.classList.add("mode-selection__next-button");
    nextButton.classList.add("mode-selection__arrow-button");
    nextButton.innerHTML = typeof rightArrIcon != 'undefined' ? rightArrIcon : ">";
    nextButton.onclick = incrementState;

    panel.appendChild(prevButton);
    for (const [text, mode] of modes) {
        panel.appendChild(createModeSelectionButton(text, mode));
    }
    panel.appendChild(nextButton);
    return panel;
}

function createModeSelectionButton(text, mode) {
    const label = document.createElement("label");
    label.classList.add("mode-selection__button");
    label.innerHTML = `<span>${text}</span>`;
    const radioBtn = document.createElement("input");
    radioBtn.type = "radio";
    radioBtn.name = "mode-selection";
    radioBtn.value = mode;
    radioBtn.checked = timetableModel.mode.name == mode;
    radioBtn.onchange = () => {
        timetableModel.mode.name = mode;
        if (isInitialized) {
            isInitialized = false;
            initPage();
        } else {
            renderTimetable();
        }
    };

    label.appendChild(radioBtn);
    return label;
}

function updateTimetable() {
    const {startOfWeek, endOfWeek} = getStartAndEndOfWeek();
    return addToTimetable(startOfWeek.getTime(), endOfWeek.getTime());
}

async function addToTimetable(start, end) {
    return await fetch(`/api/v1/meeting/time-interval-list`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            groupIds: [],
            groupMemberIds: [await getLoggedUserId()],
            teacherIds: [],
            startOfWeek: Math.round(start / 1000) * 1000,
            endOfWeek: Math.round(end / 1000) * 1000,
        }),
    }).then(response => {
        if (!response.ok) {
            initPage();
            createToast("Ошибка получения расписания");
            return;
        }
        isInitialized = false;
        response.json().then(ttjson => {
            timetableModel.table = [
                ...timetableModel.table.filter(day => day.day < start || end <= day.day),
                ...remapTimetable(ttjson, start, end),
            ].sort((a, b) => a.day - b.day);
            timetableModel.mode.name = getMode();
            renderTimetable();
        });
    })
}

function remapTimetable(timetable, start, end) {
    return fillMissingDays(
        groupEventsByDay(timetable.meetings),
        start,
        end,
    )
        .map(day => {
            return {
                ...day,
                events: day.events.sort((a, b) => a.start - b.start),
            }
        })
}

function fillMissingDays(groupedByDay, startTimestamp, endTimestamp) {
    const result = [];

    let currentDayTimestamp = getStartOfDayTimestamp(startTimestamp);
    for (let i = 1; currentDayTimestamp < endTimestamp; i++) {
        result.push({
            day: currentDayTimestamp,
            events: groupedByDay[currentDayTimestamp] || [],
        });
        currentDayTimestamp = getStartOfDayTimestamp(startTimestamp, i);
    }

    return result;
}

function createTimetable(timetable) {
    const timetableNode = document.querySelector('.timetable');
    timetableNode.innerHTML = '';
    for (const day of timetable) {
        let elt = createTimetableDay(day);
        timetableNode.appendChild(elt);
    }
}

function renderTimetable() {
    const dayBtnNode = document.querySelector("label.mode-selection__button:has(input[value=\"day\"])");
    const dayBtnState = dayBtnNode.querySelector("input").checked;
    if (timetableModel.mode.state.day != 0)
        dayBtnNode.querySelector("span").textContent = "День";
    else
        dayBtnNode.querySelector("span").textContent = "Сегодня";

    dayBtnNode.querySelector("input").checked = dayBtnState;

    rootNode.classList.remove("wait");
    document.querySelector(".mode-selection__previous-button").innerHTML = typeof leftArrIcon != 'undefined' ? leftArrIcon : "<";
    document.querySelector(".mode-selection__next-button").innerHTML = typeof rightArrIcon != 'undefined' ? rightArrIcon : ">";

    const now = new Date();
    switch(timetableModel.mode.name) {
        case "day":
            const day = getStartOfDayTimestamp(now.getTime(), timetableModel.mode.state.day);
            createTimetable(
                getDaysByRangeFromModel(day, day)
            )
            break;
        case "tomorrow":
            const tomorrow = getStartOfDayTimestamp(now.getTime(), 1);
            createTimetable(
                getDaysByRangeFromModel(tomorrow, tomorrow)
            )
            break;
        case "week":
            const {startOfWeek, endOfWeek} = getStartAndEndOfWeek(now, timetableModel.mode.state.week);
            createTimetable(getDaysByRangeFromModel(startOfWeek, endOfWeek));
            break;
    }
}

function getDaysByRangeFromModel(start, end) {
    return timetableModel.table.filter(day => start <= day.day && end >= day.day)
}

function groupEventsByDay(events) {
    const groupedByDay = {};

    events.forEach(event => {
        const dayTimestamp = getStartOfDayTimestamp(event.start);

        if (!groupedByDay[dayTimestamp]) {
            groupedByDay[dayTimestamp] = [];
        }

        groupedByDay[dayTimestamp].push(event);
    });

    return groupedByDay;
}

function createTimetableDay(day) {
    const dayNode = document.createElement("div");
    dayNode.classList.add('timetable-day');
    const dayTitleNode = document.createElement("div");
    dayTitleNode.classList.add('timetable-day__title');
    dayTitleNode.textContent = formatDate(day.day);
    dayNode.appendChild(dayTitleNode);

    for (const event of day.events) {
        dayNode.appendChild(createTimetableCard(event))
    }

    return dayNode;
}

function createTimetableCard(card) {
    const placeholder = document.createElement("div");
    placeholder.innerHTML = tableCardHTML;
    const cardNode = placeholder.firstElementChild;
    cardNode.querySelector(".timetable-card__title").textContent = card.title;
    cardNode.querySelector(".timetable-card__time").textContent = timestampToHHMM(card.start) + ' - ' + timestampToHHMM(card.end);
    cardNode.querySelector(".timetable-card__type").textContent = getMeetingType(card.lessonType);
    cardNode.querySelector(".timetable-card__teacher").innerHTML = getTeacherNames(card.organizators);
    cardNode.querySelector(".timetable-card__location").textContent = getLocation(card);

    return cardNode;
}

function getLocation(card) {
    if (!card.location) {
        return "Где? Сами ищите!";
    }
    let location = "";
    location += card.location.name || "";
    if (card.location.buildingName) {
        if (card.location.name) {
            location += " — "
        }
        location += card.location.buildingName;
    }
    return location.trim() || "Где? Сами ищите!";
}

function getTeacherNames(teachers) {
    return teachers.map(getTeacherName).join("<br>")
}

function getTeacherName(teacher) {
    let name = "";
    name += teacher?.secondName || "";
    name += teacher?.firstName && (" " + teacher.firstName) || "";
    name += teacher?.middleName && (" " + teacher.middleName) || "";
    return name;
}

function formatDate(inputDate) {
    const date = new Date(inputDate);
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayOfWeek = days[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${dayOfWeek} ${day}.${month}.${year}`;
}

function timestampToHHMM(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getStartAndEndOfWeek(date = new Date(), weekOffset = 0) {
    const baseDate = new Date(date);
    baseDate.setDate(baseDate.getDate() + weekOffset * 7);
    const dayOfWeek = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startOfWeek, endOfWeek };
}


function getStartOfDayTimestamp(timestamp, dayOffset = 0) {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function createToast(text) {
    const toastNode = document.createElement("div");
    toastNode.classList.add("toast");
    toastNode.setAttribute('data-content', text);
    document.body.appendChild(toastNode);
}

function getMeetingType(eventType) {
    switch (eventType) {
        case 1:
            return "Лекция";
        case 2:
            return "Практика";
        case 3:
            return "Семинар";
        default:
            return "хз, чё будете делать";
    }
}

function getMode() {
    const nodes = document.querySelectorAll("input[type=radio][name=\"mode-selection\"]");
    for (const node of nodes) {
        if (node.checked) {
            return node.value;
        }
    }
    return null;
}

function canRender() {
    const now = new Date();
    switch(timetableModel.mode.name) {
        case "day":
            const day = getStartOfDayTimestamp(now.getTime(), timetableModel.mode.state.day);
            return getDaysByRangeFromModel(day, day).length == 1;
        case "tomorrow":
            const tomorrow = getStartOfDayTimestamp(now.getTime(), 1);
            return getDaysByRangeFromModel(tomorrow, tomorrow).length == 1;
        case "week":
            const {startOfWeek, endOfWeek} = getStartAndEndOfWeek(now, timetableModel.mode.state.week);
            return getDaysByRangeFromModel(startOfWeek, endOfWeek).length == 7;
    }
    return false;
}

function renderStateChange() {
    if (canRender()) {
        renderTimetable();
    } else {
        const now = new Date();
        switch (timetableModel.mode.name) {
            case "day":
                addToTimetable(
                    getStartOfDayTimestamp(now.getTime(), timetableModel.mode.state.day),
                    getStartOfDayTimestamp(now.getTime(), timetableModel.mode.state.day + 1),
                );
                break;
            case "week":
                const {startOfWeek, endOfWeek} = getStartAndEndOfWeek(now, timetableModel.mode.state.week);
                addToTimetable(
                    startOfWeek,
                    endOfWeek,
                );
                break;
        }
    }
}

function incrementState() {
    timetableModel.mode.state[timetableModel.mode.name] ++;
    rootNode.classList.add("wait");
    if (typeof preloaderButton != 'undefined')
        document.querySelector(".mode-selection__next-button").innerHTML = preloaderButton;
    renderStateChange();

}

function decrementState() {
    timetableModel.mode.state[timetableModel.mode.name] --;
    rootNode.classList.add("wait");
    if (typeof preloaderButton != 'undefined')
        document.querySelector(".mode-selection__previous-button").innerHTML = preloaderButton;
    renderStateChange();
}

async function getLoggedUserId() {
    if (userId !== undefined) {
        return userId;
    }
    const response = await fetch("https://portal.ispring.institute/api/v1/logged-user/get");
    const result = await response.json();
    userId = result.userId;
    return result.userId;
}

function interruptAllRequests() {
    XMLHttpRequest.prototype.open = function() {};
}

function init(nodeSelector, interruptOtherRequests=false) {
    console.log("tt");
    if (interruptOtherRequests) {
        interruptAllRequests();
    }
    window.addEventListener("load", () => {
        rootNode = document.querySelector(nodeSelector);
        rootNode.classList.add("wait");
        initPage();
        updateTimetable();
    })
}

window.initTimetable = init;