from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from .logicStuff import testCalendar
import json
from datetime import datetime, date, time
from operator import attrgetter

# Create your views here.
def index(request):
    # context = {
    #     'posts': Post.objects.order_by('-date')
    #     if request.user.is_authenticated else []
    # }
    return render(request, 'index.html')

# returns offset to compensate for recurring event
def getStartEndPair(event):
    start = datetime.fromisoformat(event['start']['dateTime'].replace('Z', '+00:00')).astimezone()
    end = datetime.fromisoformat(event['end']['dateTime'].replace('Z', '+00:00')).astimezone()
    return start, end
    # print('event {} starts {} ends {}'.format(event['summary'], start, end))

def populateCalendar(timeList):
    resolution = 5
    calendar = [True] * int(1440 / resolution * 7)
    
    for e in timeList:
        #TODO case where event has already begun
        startIdx = int(e['delta'] .total_seconds() / 60 / resolution)
        endIdx = int(e['duration'].total_seconds() / 60 / resolution + startIdx)

        if startIdx < 0:
            endIdx += startIdx
            startIdx = 0
            
        for i in range(startIdx, endIdx + 1):
            calendar[i] = False
        
    return calendar

def printCalendar(calendar):
    line = ''
    for i in range(0, len(calendar)):
        if calendar[i]:
            line += '_'
        else:
            line += 'X'
        if i % 288 == 0:
            line += '\n'
    print(line)

def scheduleEvents(calendar, duration, startHour, endHour):
    resolution = 5
    blocksPerDay = int(1440 / resolution)
    dailyStartBlock = int(startHour * 60 / resolution)
    dailyEndBlock = int(endHour * 60 / resolution)

    breaks = []

    missedDays = 0
    for day in range(0, 7):
        startIdx = day * blocksPerDay + dailyStartBlock
        endIdx = day * blocksPerDay + dailyEndBlock
        targetBlockDuration = int(duration / resolution) + missedDays * int(duration / resolution)

        inCandidate = False
        candidateIdx = 0
        candidateLen = 0
        hasCandidate = False
        for i in range(startIdx, endIdx + 1):
            if calendar[i] and not inCandidate:
                candidateIdx = i
                candidateLen = 1
                inCandidate = True
            elif calendar[i] and inCandidate:
                candidateLen += 1
                print("found candidate with duration {}, checking with {}".format(candidateLen, targetBlockDuration))
                if candidateLen >= targetBlockDuration:
                    print('start index {}'.format(candidateIdx))
                    breaks.append({'startIdx': candidateIdx,
                                   'blocks': candidateLen})
                    hasCandidate = True
                    break
            elif not calendar[i] and inCandidate:
                #check if candidate is good enough
                candidateLen = 0
                inCandidate = False
        if hasCandidate:
            missedDays = 0
        else:
            missedDays += 1

    print("allocated {} blocks".format(len(breaks)))
    # printCalendar(calendar)
    return breaks


def postEvents(request):
    payload = json.loads(request.POST['data'])
    calendars = payload['events']
    startHour = int(payload['startHour'])
    endHour = int(payload['endHour'])
    breakDuration = int(payload['duration'])
    
    events = []
    resolution = 5
    lookAhead = 7
    days = [None] * lookAhead
    today = datetime.combine(date.today(), datetime.min.time()).astimezone()

    for c in calendars:
        for e in c:
            if e['status'] == 'confirmed' and 'dateTime' in e['start']:
                start, end = getStartEndPair(e)
                if start.hour >= startHour or end.hour <= endHour:
                    events.append({'start' : start, 'end' : end, 'summary' : e['summary']})

    events.sort(key = lambda e : e['start'])
    for e in events:
        e['delta'] = e['start'] - today
        e['duration'] = e['end'] - e['start']

    print('{} events registered'.format(len(events)))

    breaks = scheduleEvents(populateCalendar(events), breakDuration, startHour, endHour)
    breaksFormatted = []
    for b in breaks:
        f = {}
        startSec = int(b['startIdx'] * resolution * 60 + today.timestamp())
        f['start'] = datetime.fromtimestamp(startSec).isoformat()
        f['end'] = datetime.fromtimestamp(int(b['blocks'] * resolution * 60 + startSec)).isoformat()
        breaksFormatted.append(f)
        print("break from {} to {}".format(f['start'], f['end']))

    data = {'breaks' : breaksFormatted}
    return JsonResponse(data)

