browser.alarms.create({
    delayInMinutes: 0.1,
    periodInMinutes: 120
})
browser.alarms.onAlarm.addListener(fetch_mycampus)

browser.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'tracked') {
        return
    }
    browser.tabs.create({
        url: "https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/registration/registerPostSignIn?mepCode=UOIT&mode=registration",
        active: true
    })
})

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (typeof(message) === 'string') {
        browser.notifications.create('tracked', {
            type: 'basic',
            title: `${message} is now being tracked!`,
            message: 'You will be notified if a seat opens up.',
            iconUrl: 'icons/OTU.png'
        })
    } else {
        await fetch_mycampus()
        sendResponse()
    }
})

//async so that runtime.onMessage can await resolution before calling sendResponse()
async function fetch_mycampus() {
    console.log('refreshing...')
    await browser.storage.sync.get()
    //async so that the promise chain fully resolves before consecutive executions to avoid server side race cases
    .then(async items => {
        let num_open = 0
        for (let key in items) {
            if (key.startsWith('Waitlist')) {
                //fetch B100Serverpoolcookie and JSESSIONID cookies from server
                await fetch("https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/term/termSelection?mepCode=UOIT&mode=search", {
                    "method": "GET",
                })
                .then(response => {
                    /*for (const cookieName of [["B100Serverpoolcookie", "/"], ["JSESSIONID", "/StudentRegistrationSsb"]]) {
                        browser.cookies.get({
                            url: `https://ssp.mycampus.ca${cookieName[1]}`,
                            name: cookieName[0]
                        }).then(cookie => {
                            if (cookie) {
                                cookie.sameSite = browser.cookies.SameSiteStatus.NO_RESTRICTION
                                cookie.secure = true
                                cookie['url'] = 'https://' + cookie.domain + cookie.path
                                delete cookie.hostOnly
                                delete cookie.session
                                delete cookie.domain
                                browser.cookies.set(cookie)
                            }
                        })
                    }*/
                    if (response.ok) return response.text()
                    throw new Error('Error fetching cookies from server.')
                })
                .then(data => {
                    //prime the server
                    return fetch("https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/term/search?mode=search", {
                        //"credentials": "include",
                        "headers": {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        },
                        "referrer": "https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/term/termSelection?mode=search",
                        "body": `term=${items[key].Term}&studyPath=&studyPathText=&startDatepicker=&endDatepicker=&`,//uniqueSessionId=hbp5f1681265686041`,
                        "method": "POST",
                    })
                })
                .then(response => {
                    if (response.ok) return response.json()
                    throw new Error('Error priming server with academic term.')
                })
                .then(data => {
                    //resetDataForm
                    return fetch("https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/classSearch/resetDataForm", {
                        //"credentials": "include",
                        "referrer": "https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/classSearch/classSearch",
                        "method": "POST",
                    })
                })
                .then(response => {
                    if (response.ok) return response.json()
                    throw new Error('Error resetting DataForm on server.')
                })
                .then(data => {
                    //fetch the actual data after resetting the server-side form
                    return fetch(`https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/searchResults/searchResults?${new URLSearchParams({
                        txt_subjectcoursecombo: items[key].Code,
                        txt_term: items[key].Term,
                        startDatepicker: '',
                        endDatepicker: '',
                        //uniqueSessionId: 'hbp5f1681265686041',
                        pageOffset: '0',
                        pageMaxSize: '10',
                        sortColumn: 'subjectDescription',
                        sortDirection: 'asc'})}`, {
                    //"credentials": "include",
                    "referrer": "https://ssp.mycampus.ca/StudentRegistrationSsb/ssb/classSearch/classSearch",
                    "method": "GET",
                    })
                })
                .then(response => {
                    if (response.ok) return response.json()
                    throw new Error('Error fetching course information.')
                })
                .then(data => {
                    for (let course of data.data) {
                        if (course.courseReferenceNumber === items[key].CRN) {
                            console.log(course)
                            browser.storage.sync.set({[`Waitlist_${items[key].CRN}`]: {
                                Code: course.subjectCourse,
                                Title: course.courseTitle,
                                Term: course.term,
                                TermDesc: course.termDesc,
                                CRN: course.courseReferenceNumber,
                                AvailableSeats: course.seatsAvailable < 0 ? 0 : course.seatsAvailable,
                                MaximumEnrollment: course.maximumEnrollment
                            }})
                            //TODO notifications
                            if (course.seatsAvailable > 0) {
                                num_open += 1
                                browser.notifications.create({
                                    type: 'basic',
                                    title: `${course.courseTitle} now has an available seat!`,
                                    message: 'Click here to register.',
                                    iconUrl: 'icons/OTU.png'
                                })
                            }
                        }
                    }
                })
                .catch(error => {
                    console.error(error)
                })
            }
        }
        browser.browserAction.setBadgeText({text: `${num_open ? num_open : ''}`})
    })
}