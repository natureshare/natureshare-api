/* global process */

import { encrypt } from './utils/auth.js';

export default ({ app, db }) => {
    ['/users', '/users/:name'].forEach((url) =>
        app.get(url, (request, response) => {
            if (
                request.headers.authorization === `API_TOKEN ${process.env.API_TOKEN}` ||
                request.query.API_TOKEN === process.env.API_TOKEN
            ) {
                db.query(
                    `SELECT updated_at, name, email, data FROM public.user ${
                        request.params.name ? 'WHERE name = $1' : ''
                    } ORDER BY updated_at DESC`,
                    request.params.name ? [request.params.name] : [],
                )
                    .then((result) => {
                        encrypt(JSON.stringify(result.rows)).then((encrypted) =>
                            response.send(encrypted),
                        );
                    })
                    .catch(console.error);
            } else {
                response
                    .status(403) // Forbidden
                    .send({ errors: { API_TOKEN: ['mismatch'] } });
            }
        }),
    );

    if (process.env.NODE_ENV !== 'production') {
        // This was useful for the initial import script.
        app.delete('/users/all', (request, response) => {
            const dbCatch = () =>
                response.status(422).send({ errors: { username: ['not saved'] } });
            db.query('DELETE FROM public.user')
                .then((result) => {
                    console.log(result.rowCount);
                    response.send('ok');
                })
                .catch(dbCatch);
        });
    }
};
