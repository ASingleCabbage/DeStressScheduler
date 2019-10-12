// Client ID and API key from the Developer Console
var CLIENT_ID = '612141007974-opc3tshpr83nria52ai9es5mpu4f8p8u.apps.googleusercontent.com';
var API_KEY = 'AIzaSyCfDJIeHMb81snZgrhPyIfECrxcpUmHDxM';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar";

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }, function (error) {
        console.log(JSON.stringify(error, null, 2));
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        console.log("signed in")
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
    } else {
        console.log("not signed in")
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
    console.log("handling sign in")
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    console.log("handling sign out")
    gapi.auth2.getAuthInstance().signOut();
}

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre(message) {
    // var pre = document.getElementById('content');
    // var textContent = document.createTextNode(message + '\n');
    // pre.appendChild(textContent);
}

let calendarEvents = []
let recurringCounter = 0
let normalCounter = 0

function populateCalendar(events){
    let eventsCreated = 0
    gapi.client.calendar.calendars.insert({
        'summary' : 'Stress Break Scheduler',
        'timeZone' : 'America/New_York',
    }).then(function(response){
        console.log(response)
        for(var i = 0; i < events.length; i++){
            gapi.client.calendar.events.insert({
                "calendarId": response['result']['id'],
                "sendNotifications": true,
                "resource": {
                    "end": {
                        "dateTime": events[i]['end'],
                        "timeZone": "America/New_York",
                    },
                    "start": {
                        "dateTime": events[i]['start'],
                        "timeZone": "America/New_York",
                    },
                    "summary" : 'Mandatory DeStress'
                }
    
            }).then(function(response){
                console.log(response)
                eventsCreated += 1
                if(eventsCreated == events.length){
                    console.log("all events created")
                    alert("Events successfully created");
                    $("#goButton").attr("disabled", false);
                    $("#goButton").text("Ready? Set? Go!");

                }
            })
        }
    })    
}

function updateDuration(){
    var checked = $('#mainForm :input[type="checkbox"]:checked').length
    var bonus = Math.floor((checked * 2) / 5)
    return 15 + bonus * 5
}

function sendEvents(){
    console.log("SENDING")

    startHour = $('#startHour').val()
    endHour = $('#endHour').val()
    if(startHour){
        startHour = 12
    }
    if(endHour){
        endHour == 17
    }

    data = { 'events': calendarEvents, 
             'startHour': startHour, 
             'endHour': endHour, 
             'duration': updateDuration(),}


    var csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    $.post("http://localhost:8000/processEvents/", 
    { 
        "csrfmiddlewaretoken" : csrfToken, 
        data: JSON.stringify(data),
    }).done(function(data){
        console.log(data)
        populateCalendar(data.breaks)
    })

}

function getRecurringEvents(calendarId, event, start, end){
    recurringCounter += 1
    // console.log(calendarId + " " + event + " " + start.toISOString() + " " + end.toISOString())

    gapi.client.calendar.events.instances(
        {
            "calendarId": calendarId,
            "eventId": event,
            "timeMin": start,
            "timeMax": end,
        }
    ).then(function(response){
        var items = response.result.items
        console.log(items)
        if (items.length > 0) {
            for (i = 0; i < items.length; i++) {
                appendPre(items[i].summary + " recurring")
            }
            calendarEvents.push(items)
        }

        recurringCounter -= 1
        if(recurringCounter == 0 && normalCounter == 0){
            console.log(calendarEvents)
            sendEvents()
        }
    })

}

function getEvents(calendarId, start, end) {
    normalCounter += 1
    gapi.client.calendar.events.list(
        {
            "calendarId": calendarId,
            "timeMin": start,
            "timeMax": end,
        }
    ).then(function (response) {
        var items = response.result.items
        var noRecurrence = []
        if (items.length > 0) {
            for (i = 0; i < items.length; i++) {
                appendPre(items[i].summary)
                if ('recurrence' in items[i]) {
                    console.log(items[i].summary + " is a recurring event")
                    getRecurringEvents(calendarId, items[i].id, start, end)
                }else{
                    noRecurrence.push(items[i])
                }
            }
            calendarEvents.push(noRecurrence)
        } else {
            appendPre('No events for the upcoming week in calendar found.')
        }

        normalCounter -= 1
        if (normalCounter == 0 && recurringCounter == 0) {
            //calendarEvents is fully populated
            console.log(calendarEvents)
            sendEvents()
        }
    })
}

 function listUpcomingEvents() {
    let calendarIds = []
    let now = new Date()
    let weekLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)

    //only called once
    gapi.client.calendar.calendarList.list().then(function (response) {
        console.log(response.result)
        var items = response.result.items
        if (items.length > 0) {
            for(var i = 0; i < items.length; i++){
                var calendarId = items[i].id
                console.log(calendarId)
                //called num of calender times
                getEvents(calendarId, now.toISOString(), weekLater.toISOString())
            }
        } else {
            appendPre('No calendar found.')
        }
    })
}

$('.form-check-input').change(function(){
    $('#estimate').text(updateDuration())
})

$('#goButton').click(function(){
    $('#goButton').text("Processing...")
    $("#goButton").attr("disabled", true);
    listUpcomingEvents();
})