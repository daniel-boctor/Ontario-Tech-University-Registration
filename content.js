function fetch_RMP(prof_name, index) {
    //format prof_name from First Last-Last -> First Last
    prof_name = prof_name.split(' ').map(sub => {
        return sub.substring(sub.indexOf("-") + 1)
    }).join(' ')
    //fetching ID for a given prof_name
    fetch("https://www.ratemyprofessors.com/graphql", {
        "headers": {
            "Authorization": "Basic dGVzdDp0ZXN0",
        },
        "referrer": "https://www.ratemyprofessors.com/",
        "body": `${string_1},
        \"variables\":{\"query\":{\"text\":\"${prof_name}\",\"schoolID\":\"U2Nob29sLTQ3MTQ=\"}}}`,
        "method": "POST",
    })
    .then(response => {
        if (response.ok) return response.json()
        throw new Error('Network response was not ok.')
    })
    .then(data => {
        if (data.data.newSearch.teachers.edges.length === 0) {
            inject_table(`<table style="width: 100%;"><thead><tr>
                <th><a onclick="window.open(this.href); return false;" href="https://www.ratemyprofessors.com/search/teachers?query=${prof_name}&sid=U2Nob29sLTQ3MTQ=">${prof_name}</a></th>
            </tr></thead><tbody><tr><td>No data available.</td></tr></tbody></table>`, index)
            throw new Error(`No data available for ${prof_name}.`)
        }
        //fetching info for a given (prof_name) ID
        return fetch("https://www.ratemyprofessors.com/graphql", {
            "headers": {
                "Authorization": "Basic dGVzdDp0ZXN0",
            },
            "referrer": "https://www.ratemyprofessors.com/professor/1579873",
            "body": `${string_2},
            \"variables\":{\"id\":\"${data.data.newSearch.teachers.edges[0].node.id}\"}}`,
            "method": "POST",
        })
    })
    .then(response => {
        if (response.ok) return response.json()
        throw new Error('Network response was not ok.')
    })
    .then(data => {
        const node = data.data.node
        inject_table(`
        <table style="width: 100%;">
            <thead>
                <tr>
                    <th><a onclick="window.open(this.href); return false;" href="https://www.ratemyprofessors.com/professor/${node.legacyId}">${node.firstName} ${node.lastName}</a></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><h1 style="display: inline;">${node.avgRating || 'N/A'}</h1> / 5 | ${node.numRatings} ratings</td>
                </tr>
                ${node.numRatings === 0 ? '' : `
                <tr>
                    <td>${node.wouldTakeAgainPercent}% would take again</td>
                </tr>
                <tr>
                    <td>${node.avgDifficulty} / 5 difficulty</td>
                </tr>`}
            </tbody>
        </table>
        `, index)
    })
    .catch(error => {
        console.error(error)
    })
}

function inject_table(cell_content, index) {
    $('td[data-property="instructor"] > a').each(function(tmp) {
        if (tmp===index) {
            $(this).hide()
            $(this).parent().contents().filter(function() {
                return this.nodeType === 3 || this.tagName === 'BR' // nodeType 3 is a text node
              }).remove()                  
            $(this).parent().append(cell_content)
        }
    })
}

//observing when to inject
const mainTargetNode = document.querySelector('#searchTerms')
const pageTargetNode = document.querySelector(".page-number")
const config = {childList: true , characterData: true, subtree: true}
const observerRMP = new MutationObserver(inject_RMP)
const observerWaitlist = new MutationObserver(inject_waitlist)
if (mainTargetNode) {observerWaitlist.observe(mainTargetNode, config)}
if (pageTargetNode) {observerWaitlist.observe(pageTargetNode, config)}

//removing .add-row-hover
const targetNode = document.querySelector('#searchResults')
const configHover = {attributes: true, subtree: true, attributeFilter: ['class']}
const observerHover = new MutationObserver((mutationList) => {
    mutationList.forEach((mutation) => {
        if (mutation.target.classList.contains('add-row-hover')) {
            mutation.target.classList.remove('add-row-hover')
            mutation.target.style.backgroundColor = 'transparent'
        }
    })
})

browser.storage.sync.get('RMP_enable')
.then(item => {
    if (item.RMP_enable !== false) {
        if (mainTargetNode) {observerRMP.observe(mainTargetNode, config)}
        if (pageTargetNode) {observerRMP.observe(pageTargetNode, config)}
        if (targetNode) {observerHover.observe(targetNode, configHover)}
    }
})

function inject_RMP() {
    $('td[data-property="instructor"] > a').each(function(index) {
        //format prof_name from last, first -> first last
        fetch_RMP(prof_name=$(this).text().split(', ').reverse().join(' '), index=index)
    })
}

function inject_waitlist() {
    $('td[data-property="status"] > .status-full').each(function() {
        const table_row = $(this).parent().parent()
        const subject = table_row.find('td[data-property="subject"]').text()
        const code = table_row.find('td[data-property="courseNumber"]').text()
        const title = table_row.find('td[data-property="courseTitle"] > a').text()
        const term_desc = table_row.find('td[data-property="term"]').text()
        const data_attributes = table_row.find('td[data-property="courseTitle"] > a').data('attributes').split(',')
        const maximum_enrollment = $(this).text().split('of')[1].split('seats remain')[0].trim()
        $(this).parent().prepend(`<button type="button" role="button" style="margin-bottom: 5px; padding-top: 5px; padding-bottom: 5px;" aria-label="Waitlist" class="form-button add-section-button view-linked-sections-button" tabindex="-1">Waitlist</button>`)
        //style button conditionally
        browser.storage.sync.get(`Waitlist_${data_attributes[1]}`)
        .then(item => {
            if (item[`Waitlist_${data_attributes[1]}`]) {
                $(this).parent().find('button').prop('disabled', true)
            }
        })
        //call storage API with course on click
        $(this).parent().find('button').on('click', function() {
            browser.storage.sync.set({[`Waitlist_${data_attributes[1]}`]: {
                Code: subject + code,
                Title: title,
                Term: data_attributes[0],
                TermDesc: term_desc,
                CRN: data_attributes[1],
                AvailableSeats: 0,
                MaximumEnrollment: maximum_enrollment
            }})
            .then(() => {
                $(this).parent().find('button').prop('disabled', true)
                browser.runtime.sendMessage(title)
            })
            .catch(error => {console.error(error)})
        })
    })
}