browser.storage.sync.get('RMP_enable')
.then(item => {
    if ('RMP_enable' in item) {
        $('#RMP_enable').prop('checked', item.RMP_enable)
    }
})

$('#RMP_enable').on("change", function() {
    browser.storage.sync.set({"RMP_enable": this.checked})
})

function populate_table() {
    browser.storage.sync.get()
    .then(items => {
        let filtered_keys = []
        for (let key in items) {
            if (key.startsWith('Waitlist')) {
                filtered_keys.push(key)
                $('tbody').append(`
                    <tr>
                        <th>${items[key].Code}</th>
                        <td>${items[key].Title}</td>
                        <td>${items[key].CRN}</td>
                        <td>${items[key].TermDesc}</td>
                        <th><span style="color: ${items[key].AvailableSeats ? 'green' : 'red'};">
                            ${items[key].AvailableSeats ? items[key].AvailableSeats : 'FULL'}</span> / ${items[key].MaximumEnrollment}
                        </th>
                        <td><a role="button" class="link-danger" id="${items[key].CRN}">Remove</a></td>
                    </tr>
                `)
            }
        }
        $('.link-danger').off().on("click", async function() {
            if (this.id === "remove_all") {
                if (!window.confirm("Are you sure you want to delete all courses?")) {return}
                await browser.storage.sync.remove(filtered_keys)

            } else {
                await browser.storage.sync.remove(`Waitlist_${this.id}`)
            }
            refresh()
        })
        if (filtered_keys.length === 0) {
            $('tbody').append('<tr><td colspan="6"><small class="text-muted">No courses saved.</small></td></tr>')
            $('table').width(600)
        }
        $('tbody > tr:has(.placeholder)').remove()
    })
}

populate_table()

$('#refresh').on("click", refresh)

function refresh() {
    if ($('tbody > tr .placeholder').length) {return}
    $('tbody > tr').each(function() {
        $(this).children().each(function() {
            $(this).html(`<div style="width: ${$(this).width()}px;" class="placeholder-glow"><span class="placeholder col-12"></span></div>`)
        })
    })
    browser.runtime.sendMessage(true)
    .then(populate_table)
    .catch(error => {console.error(error)})
}