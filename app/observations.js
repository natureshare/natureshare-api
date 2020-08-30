/* global process URL URLSearchParams */

import fs from 'fs';

export default function observations({ app }) {
    const observationsIndex = JSON.parse(fs.readFileSync('legacyObservationsIndex.json'));

    app.get('/observations/:id', (request, response) => {
        const url = new URL(process.env.APP_HOST);
        if (request.params.id && observationsIndex[request.params.id]) {
            url.pathname = '/item';
            url.search = new URLSearchParams({
                i: [observationsIndex[request.params.id], `${request.params.id}.yaml`].join('/'),
            });
            // permanent: 308
            response.redirect(308, url.href);
        } else {
            // temporary: 307
            response.redirect(307, url.href);
        }
    });
}
