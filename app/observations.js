import fs from 'fs';

export default function observations({ app }) {
    const observationsIndex = JSON.parse(fs.readFileSync('legacyObservationsIndex.json'));

    app.get('/observations/:id', (request, response) => {
        // temporary: 307
        // permanent: 308
        if (request.params.id && observationsIndex[request.params.id]) {
            response.redirect(
                308,
                `https://natureshare.org.au/item?i=${encodeURIComponent(
                    [observationsIndex[request.params.id], `${request.params.id}.yaml`].join('/'),
                )}`,
            );
        } else {
            response.redirect(307, 'https://natureshare.org.au/');
        }
    });
}
